import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import {
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Settings,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import switzerlandData from "@/data/switzerland.json";
import {
  SATELLITE_REGIONS,
  getRegion,
  getSatelliteManifest,
  type SatelliteRegionId,
  type SatelliteFrame,
} from "@/lib/satellite.functions";

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
const BRAND = "#2561a1";
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

// Play-Geschwindigkeiten: reale ms zwischen zwei Frame-Schritten.
// Der RAF-Loop wandelt das in eine kontinuierliche Zeitrate um.
const SPEEDS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "2×", ms: 250 },
  { label: "4×", ms: 125 },
];

function FlyToRegion({ regionId }: { regionId: SatelliteRegionId }) {
  const map = useMap();
  useEffect(() => {
    const r = getRegion(regionId);
    map.setMinZoom(r.zoom);
    map.setMaxZoom(r.zoom);
    map.setView(r.center, r.zoom, { animate: true });
  }, [regionId, map]);
  return null;
}

function SwissOutline() {
  return (
    <GeoJSON
      data={SWITZERLAND}
      style={{ color: "#ffffff", weight: 1.5, opacity: 0.9, fill: false, interactive: false }}
    />
  );
}

// ---------- Frame-Stack mit stabilem Double-Buffer ----------
// Leaflet-WMS-TileLayer werden hier bewusst nicht pro Satellitenzeit gemountet:
// genau dieses Tile-/Layer-Churn erzeugt sichtbare Leerzustände im Tile-Pane.
// Stattdessen lädt der Renderer pro Zeitpunkt ein komplettes GetMap-Bild,
// dekodiert es im Hintergrund und blendet zwei dauerhaft gemountete <img>-Buffer
// über eine kontinuierliche Zeitachse. Dadurch bleibt immer ein vollständiges
// Bild sichtbar; React und Leaflet werden im RAF-Pfad nicht neu gerendert.

type FrameEntry = {
  iso: string;
  t: number;
  url: string;
  status: "idle" | "loading" | "ready" | "error";
  image?: HTMLImageElement;
  promise?: Promise<void>;
};

type FrameStackHandle = {
  /** Setzt die aktuell darzustellende Zeit (ms). Blendet zwischen den beiden
   *  benachbarten WMS-Frames kontinuierlich über. */
  setTimeMs: (ms: number) => void;
  /** True, wenn bei `ms` beide Nachbar-Frames vollständig geladen sind. */
  canAdvanceTo: (ms: number) => boolean;
  /** True, wenn für `ms` mindestens ein renderfertiger Frame gezeigt werden kann. */
  hasRenderableAt: (ms: number) => boolean;
};

const FrameStack = forwardRef<
  FrameStackHandle,
  {
    layer: string;
    frames: SatelliteFrame[];
    initialIso: string | null;
    onProgress: (loaded: number, total: number) => void;
  }
>(function FrameStack(
  { layer, frames, initialIso, onProgress },
  ref,
) {
  const map = useMap();
  const entriesRef = useRef<Map<string, FrameEntry>>(new Map());
  const orderedRef = useRef<FrameEntry[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgARef = useRef<HTMLImageElement | null>(null);
  const imgBRef = useRef<HTMLImageElement | null>(null);
  const imgAIsoRef = useRef<string | null>(null);
  const imgBIsoRef = useRef<string | null>(null);
  const lastVisibleIsoRef = useRef<string | null>(null);
  const targetMsRef = useRef<number | null>(null);
  const preloadTimersRef = useRef<number[]>([]);
  const viewportRef = useRef<{ key: string; bbox: string; width: number; height: number } | null>(null);
  const [viewportKey, setViewportKey] = useState("");
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const markProgress = useCallback(() => {
    const total = orderedRef.current.length || 1;
    let loaded = 0;
    for (const e of orderedRef.current) if (e.status === "ready") loaded++;
    onProgressRef.current(loaded, total);
  }, []);

  const computeViewport = useCallback(() => {
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return null;
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxSide = 2048;
    const scale = Math.max(1, Math.min(rawDpr, maxSide / size.x, maxSide / size.y));
    const width = Math.max(1, Math.round(size.x * scale));
    const height = Math.max(1, Math.round(size.y * scale));
    const bounds = map.getBounds();
    const crs = map.options.crs ?? L.CRS.EPSG3857;
    const sw = crs.project(bounds.getSouthWest());
    const ne = crs.project(bounds.getNorthEast());
    const bbox = [sw.x, sw.y, ne.x, ne.y].map((n) => n.toFixed(2)).join(",");
    return { key: `${bbox}:${width}x${height}`, bbox, width, height };
  }, [map]);

  const buildUrl = useCallback((iso: string): string | null => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const params = new URLSearchParams({
      service: "WMS",
      request: "GetMap",
      version: "1.3.0",
      layers: layer,
      styles: "",
      format: "image/png",
      transparent: "false",
      crs: "EPSG:3857",
      bbox: vp.bbox,
      width: String(vp.width),
      height: String(vp.height),
      time: iso,
    });
    return `${WMS_URL}?${params.toString()}`;
  }, [layer]);

  // Stabile Overlay-DOM-Knoten einmal anlegen. Die beiden Bildbuffer bleiben
  // während Playback/Scrubbing dauerhaft gemountet; es werden nur src/opacity
  // aktualisiert.
  useEffect(() => {
    const root = map.getContainer();
    const container = L.DomUtil.create("div", "satellite-image-stack", root);
    const imgA = new Image();
    const imgB = new Image();
    imgA.decoding = "async";
    imgB.decoding = "async";
    imgA.alt = "Satellitenbild vorheriger Zeitpunkt";
    imgB.alt = "Satellitenbild nächster Zeitpunkt";
    imgA.className = "satellite-buffer-image";
    imgB.className = "satellite-buffer-image";
    imgA.style.opacity = "0";
    imgB.style.opacity = "0";
    container.append(imgA, imgB);
    containerRef.current = container;
    imgARef.current = imgA;
    imgBRef.current = imgB;

    return () => {
      for (const timer of preloadTimersRef.current) window.clearTimeout(timer);
      preloadTimersRef.current = [];
      container.remove();
      entriesRef.current.clear();
      orderedRef.current = [];
      imgAIsoRef.current = null;
      imgBIsoRef.current = null;
      lastVisibleIsoRef.current = null;
      targetMsRef.current = null;
      containerRef.current = null;
      imgARef.current = null;
      imgBRef.current = null;
    };
  }, [map]);

  // Viewport-/Region-Änderungen erzeugen neue GetMap-URLs. Das sichtbare alte
  // Bild bleibt stehen, bis die neuen Bilder dekodiert wurden.
  useEffect(() => {
    const updateViewport = () => {
      const next = computeViewport();
      if (!next || next.key === viewportRef.current?.key) return;
      viewportRef.current = next;
      setViewportKey(next.key);
    };
    updateViewport();
    const raf = requestAnimationFrame(updateViewport);
    map.on("resize moveend zoomend", updateViewport);
    return () => {
      cancelAnimationFrame(raf);
      map.off("resize moveend zoomend", updateViewport);
    };
  }, [computeViewport, map]);

  const neighborsAt = useCallback((ms: number): { prev: FrameEntry | null; next: FrameEntry | null; alpha: number } => {
    const arr = orderedRef.current;
    if (arr.length === 0) return { prev: null, next: null, alpha: 0 };
    // Randfälle
    if (ms <= arr[0].t) return { prev: arr[0], next: arr[0], alpha: 0 };
    if (ms >= arr[arr.length - 1].t) {
      const last = arr[arr.length - 1];
      return { prev: last, next: last, alpha: 0 };
    }
    // Binäre Suche: iPrev = letzter mit t <= ms
    let lo = 0;
    let hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid].t <= ms) lo = mid;
      else hi = mid - 1;
    }
    const prev = arr[lo];
    const next = arr[Math.min(lo + 1, arr.length - 1)];
    const dt = next.t - prev.t;
    const a = dt > 0 ? Math.max(0, Math.min(1, (ms - prev.t) / dt)) : 0;
    return { prev, next, alpha: a * a * (3 - 2 * a) };
  }, []);

  const findReadyNeighbor = useCallback((fromIndex: number, dir: -1 | 1): FrameEntry | null => {
    const arr = orderedRef.current;
    for (let i = fromIndex; i >= 0 && i < arr.length; i += dir) {
      if (arr[i].status === "ready") return arr[i];
    }
    return null;
  }, []);

  const hasRenderableAt = useCallback((ms: number): boolean => {
    const arr = orderedRef.current;
    if (arr.length === 0) return false;
    const { prev, next } = neighborsAt(ms);
    if (prev?.status === "ready" || next?.status === "ready") return true;
    const stickyIso = lastVisibleIsoRef.current;
    const sticky = stickyIso ? entriesRef.current.get(stickyIso) : null;
    return sticky?.status === "ready";
  }, [neighborsAt]);

  const setImgSource = useCallback((slot: "a" | "b", entry: FrameEntry | null) => {
    const img = slot === "a" ? imgARef.current : imgBRef.current;
    if (!img) return;
    const isoRef = slot === "a" ? imgAIsoRef : imgBIsoRef;
    if (!entry || entry.status !== "ready") {
      img.style.opacity = "0";
      isoRef.current = null;
      return;
    }
    if (isoRef.current !== entry.iso) {
      img.src = entry.url;
      isoRef.current = entry.iso;
    }
  }, []);

  const applyTime = useCallback((ms: number) => {
    const arr = orderedRef.current;
    if (arr.length === 0) return;
    const { prev, next, alpha } = neighborsAt(ms);
    if (!prev || !next) return;

    let showA: FrameEntry | null = null;
    let showB: FrameEntry | null = null;
    let effAlpha = 0;

    if (prev === next) {
      if (prev.status === "ready") { showA = prev; effAlpha = 0; }
    } else if (prev.status === "ready" && next.status === "ready") {
      showA = prev; showB = next; effAlpha = alpha;
    } else if (prev.status === "ready") {
      showA = prev; effAlpha = 0;
    } else if (next.status === "ready") {
      showA = next; effAlpha = 0;
    } else {
      const stickyIso = lastVisibleIsoRef.current;
      const sticky = stickyIso ? entriesRef.current.get(stickyIso) : null;
      if (sticky?.status === "ready") {
        showA = sticky;
      } else {
        const idxPrev = arr.indexOf(prev);
        const l = findReadyNeighbor(idxPrev, -1);
        const r = findReadyNeighbor(Math.min(arr.length - 1, idxPrev + 1), 1);
        showA = l ?? r;
      }
    }

    if (!showA && !showB) return;

    const imgA = imgARef.current;
    const imgB = imgBRef.current;
    if (!imgA || !imgB) return;

    if (showA && showB) {
      setImgSource("a", showA);
      setImgSource("b", showB);
      imgA.style.opacity = String(1 - effAlpha);
      imgB.style.opacity = String(effAlpha);
      lastVisibleIsoRef.current = effAlpha >= 0.5 ? showB.iso : showA.iso;
    } else if (showA) {
      setImgSource("a", showA);
      setImgSource("b", null);
      imgA.style.opacity = "1";
      imgB.style.opacity = "0";
      lastVisibleIsoRef.current = showA.iso;
    }
  }, [findReadyNeighbor, neighborsAt, setImgSource]);

  const ensureFrame = useCallback((entry: FrameEntry) => {
    if (entry.status === "ready" || entry.status === "loading") return entry.promise;
    entry.status = "loading";
    const image = new Image();
    image.decoding = "async";
    const promise = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Satellite image failed: ${entry.iso}`));
      image.src = entry.url;
    })
      .then(() => image.decode?.().catch(() => undefined))
      .then(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }))
      .then(() => {
        entry.status = "ready";
        entry.image = image;
        markProgress();
        const target = targetMsRef.current;
        if (target !== null) applyTime(target);
      })
      .catch(() => {
        entry.status = "error";
        markProgress();
      });
    entry.promise = promise;
    return promise;
  }, [applyTime, markProgress]);

  // Cache/Preload: URLs sind pro Viewport stabil. Bereits dekodierte Bilder
  // werden wiederverwendet; neue Manifest-Zeiten werden nur ergänzt.
  useEffect(() => {
    if (frames.length === 0 || !viewportRef.current) return;

    for (const timer of preloadTimersRef.current) window.clearTimeout(timer);
    preloadTimersRef.current = [];
    const nextEntries = new Map<string, FrameEntry>();

    const getOrCreateEntry = (iso: string): FrameEntry | null => {
      const url = buildUrl(iso);
      if (!url) return null;
      const existing = entriesRef.current.get(iso);
      if (existing?.url === url) {
        nextEntries.set(iso, existing);
        return existing;
      }
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return null;
      const entry: FrameEntry = {
        iso,
        t,
        url,
        status: "idle",
      };
      nextEntries.set(iso, entry);
      return entry;
    };

    const isoOrder = frames.map((f) => f.time);
    const initIdxRaw = initialIso ? isoOrder.indexOf(initialIso) : -1;
    const initIdx = initIdxRaw >= 0 ? initIdxRaw : Math.max(0, isoOrder.length - 1);
    const priority: string[] = [];
    const pushUnique = (iso: string | undefined) => {
      if (iso && !priority.includes(iso)) priority.push(iso);
    };
    pushUnique(isoOrder[initIdx]);
    pushUnique(isoOrder[(initIdx + 1) % isoOrder.length]);
    pushUnique(isoOrder[Math.max(0, initIdx - 1)]);
    for (let d = 1; d < isoOrder.length; d++) {
      const a = initIdx + d;
      const b = initIdx - d;
      if (a < isoOrder.length) pushUnique(isoOrder[a]);
      if (b >= 0) pushUnique(isoOrder[b]);
    }

    const rebuilt: FrameEntry[] = [];
    for (const f of frames) {
      const e = getOrCreateEntry(f.time);
      if (e) rebuilt.push(e);
    }
    entriesRef.current = nextEntries;
    orderedRef.current = rebuilt;

    markProgress();

    for (const [i, iso] of priority.entries()) {
      const entry = nextEntries.get(iso);
      if (!entry) continue;
      if (i < 3) {
        void ensureFrame(entry);
      } else {
        const timer = window.setTimeout(() => {
          const latest = entriesRef.current.get(iso);
          if (latest) void ensureFrame(latest);
        }, 55 * (i - 2));
        preloadTimersRef.current.push(timer);
      }
    }

    if (targetMsRef.current !== null) applyTime(targetMsRef.current);
  }, [frames, layer, initialIso, viewportKey, buildUrl, ensureFrame, markProgress, applyTime]);

  useImperativeHandle(
    ref,
    () => ({
      setTimeMs: (ms: number) => {
        targetMsRef.current = ms;
        applyTime(ms);
      },
      canAdvanceTo: (ms: number) => {
        const { prev, next } = neighborsAt(ms);
        if (!prev || !next) return false;
        return prev.status === "ready" && next.status === "ready";
      },
      hasRenderableAt,
    }),
    [neighborsAt, applyTime, hasRenderableAt],
  );

  return null;
});

// ---------- Filmstrip (Radar-Look, kontinuierliche Zeitachse) ----------

const STRIP_COLOR = BRAND;

function fmtBubble(d: Date): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wd}, ${hh}:${mm}`;
}

type FilmstripHandle = { setTime: (ms: number) => void };

type FilmstripProps = {
  tMin: number;
  tMax: number;
  isMobile: boolean;
  playing: boolean;
  /** Wird bei laufendem Scrub für jeden RAF-Frame aufgerufen; commit=true beim Release. */
  onScrubMs: (ms: number, commit: boolean) => void;
};

const SatelliteFilmstrip = forwardRef<FilmstripHandle, FilmstripProps>(function SatelliteFilmstrip(
  { tMin, tMax, isMobile, playing, onScrubMs },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const containerWRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialW = containerRef.current.getBoundingClientRect().width;
    containerWRef.current = initialW;
    setContainerW(initialW);
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        containerWRef.current = e.contentRect.width;
        setContainerW(e.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PX_PER_HOUR = isMobile ? 56 : 72;
  const totalWidth = ((tMax - tMin) / 3_600_000) * PX_PER_HOUR;

  const hours = useMemo(() => {
    const start = Math.ceil(tMin / 3_600_000) * 3_600_000;
    const out: { ms: number; left: number; hour: number }[] = [];
    for (let t = start; t <= tMax; t += 3_600_000) {
      out.push({
        ms: t,
        left: ((t - tMin) / 3_600_000) * PX_PER_HOUR,
        hour: new Date(t).getHours(),
      });
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const ticks10 = useMemo(() => {
    const start = Math.ceil(tMin / 600_000) * 600_000;
    const out: number[] = [];
    for (let t = start; t <= tMax; t += 600_000) {
      out.push(((t - tMin) / 3_600_000) * PX_PER_HOUR);
    }
    return out;
  }, [tMin, tMax, PX_PER_HOUR]);

  const dayBreaks = hours.filter((h) => h.hour === 0);

  const currentMotionRef = useRef((tMin + tMax) / 2);
  const draggingRef = useRef(false);
  const ariaLastRef = useRef(0);

  const paintTime = useCallback(
    (ms: number) => {
      const clamped = Math.max(tMin, Math.min(tMax, ms));
      currentMotionRef.current = clamped;
      const w = containerWRef.current || containerW;
      const x = w / 2 - ((clamped - tMin) / 3_600_000) * PX_PER_HOUR;
      if (stripRef.current) stripRef.current.style.transform = `translate3d(${x}px,0,0)`;
      if (bubbleRef.current) bubbleRef.current.textContent = fmtBubble(new Date(clamped));
      // ARIA nur gedrosselt aktualisieren
      const now = performance.now();
      if (now - ariaLastRef.current > 200 && containerRef.current) {
        ariaLastRef.current = now;
        const pct = Math.round(((clamped - tMin) / Math.max(1, tMax - tMin)) * 1000);
        containerRef.current.setAttribute("aria-valuenow", String(pct));
      }
    },
    [tMin, tMax, PX_PER_HOUR, containerW],
  );

  useImperativeHandle(ref, () => ({ setTime: paintTime }), [paintTime]);

  // Beim Zeitfenster-Wechsel oder Resize erste Position setzen.
  useEffect(() => {
    if (!draggingRef.current) paintTime(currentMotionRef.current);
  }, [tMin, tMax, containerW, paintTime]);

  const dragStartRef = useRef<{ x: number; ms: number } | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, ms: currentMotionRef.current };
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(6); } catch { /* ignore */ }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dMs = (-dx / PX_PER_HOUR) * 3_600_000;
    const target = Math.max(tMin, Math.min(tMax, dragStartRef.current.ms + dMs));
    pendingTargetRef.current = target;
    if (rafPendingRef.current !== null) return;
    rafPendingRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = null;
      const t = pendingTargetRef.current;
      if (t === null) return;
      paintTime(t);
      onScrubMs(t, false);
    });
  };
  const onUp = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
      rafPendingRef.current = null;
    }
    pendingTargetRef.current = null;
    draggingRef.current = false;
    onScrubMs(currentMotionRef.current, true);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const initialX = containerW / 2 - ((currentMotionRef.current - tMin) / 3_600_000) * PX_PER_HOUR;

  return (
    <div className="select-none">
      {/* Bubble über fixer Mittellinie */}
      <div className="relative h-7">
        <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            ref={bubbleRef}
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
            style={{ background: STRIP_COLOR }}
          >
            {fmtBubble(new Date(currentMotionRef.current))}
          </span>
          <span
            className="h-0 w-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${STRIP_COLOR}`,
            }}
          />
        </div>
      </div>

      {/* Filmstreifen */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Satellit-Zeit"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={0}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-12 cursor-grab touch-none overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-b from-neutral-50 to-neutral-100 shadow-inner outline-none active:cursor-grabbing focus-visible:ring-2"
        style={{ ['--tw-ring-color' as never]: STRIP_COLOR }}
      >
        {/* Fixe Mittel-Linie */}
        <span className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px -translate-x-1/2 bg-neutral-900/85" />
        <span
          className="pointer-events-none absolute left-1/2 top-0 z-30 h-2 w-2 -translate-x-1/2 rotate-45"
          style={{ background: STRIP_COLOR }}
        />

        {/* Scrollender Strip */}
        <div
          ref={stripRef}
          className="absolute inset-y-0 left-0 will-change-transform"
          style={{
            width: `${totalWidth}px`,
            transform: `translate3d(${initialX}px,0,0)`,
            transition: playing ? "none" : "none",
          }}
        >
          {/* Zeit-Band */}
          <div
            className="absolute top-6 h-4 rounded-sm"
            style={{ left: 0, width: totalWidth, background: STRIP_COLOR, opacity: 0.6 }}
          />

          {/* 10-min-Ticks */}
          {ticks10.map((l, i) => (
            <span key={`m10-${i}`} className="absolute top-7 h-2 w-px bg-white/45" style={{ left: l }} />
          ))}

          {/* Stunden-Ticks + Labels */}
          {hours.map((h) => (
            <div key={`h-${h.ms}`} className="absolute top-0 h-full" style={{ left: h.left }}>
              <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-neutral-600">
                {String(h.hour).padStart(2, "0")}:00
              </span>
              <span className="absolute top-6 h-4 w-px bg-neutral-900/40" />
            </div>
          ))}

          {/* Tageswechsel */}
          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="absolute top-6 h-4 w-[2px] bg-neutral-900/70"
              style={{ left: b.left }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------- Main ----------

export function SatelliteMap({ bare = false }: { bare?: boolean } = {}) {
  const [regionId, setRegionId] = useState<SatelliteRegionId>("alpen-ch");
  const region = useMemo(() => getRegion(regionId), [regionId]);
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["satellite-manifest", regionId],
    queryFn: () => getSatelliteManifest({ data: { region: regionId } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const frames = useMemo(() => data?.frames ?? [], [data]);
  const times = useMemo(() => frames.map((f) => Date.parse(f.time)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;

  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [uiIndex, setUiIndex] = useState(0); // nur für Buttons/Prev-Next
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<string | null>(null);

  const total = frames.length;
  const selectedIso = useMemo(() => {
    if (frames.length === 0) return null;
    if (lastTimeRef.current && frames.some((f) => f.time === lastTimeRef.current)) {
      return lastTimeRef.current;
    }
    return frames[frames.length - 1].time;
  }, [frames]);
  const ready = total > 0 && loaded >= total;

  // Kontinuierliche Zeit als Single Source of Truth.
  const renderMsRef = useRef<number>(0);
  const filmstripRef = useRef<FilmstripHandle | null>(null);
  const stackRef = useRef<FrameStackHandle | null>(null);

  // Throttled loaded-Counter — vermeidet Render-Feuer bei jedem Tile-Load-Event.
  const loadedPendingRef = useRef<number | null>(null);
  const loadedTimerRef = useRef<number | null>(null);
  const handleStackProgress = useCallback((l: number, _total: number) => {
    loadedPendingRef.current = l;
    if (loadedTimerRef.current !== null) return;
    loadedTimerRef.current = window.setTimeout(() => {
      loadedTimerRef.current = null;
      const v = loadedPendingRef.current;
      if (v !== null) setLoaded(v);
    }, 200);
  }, []);
  useEffect(() => () => {
    if (loadedTimerRef.current !== null) window.clearTimeout(loadedTimerRef.current);
  }, []);

  // Übersetzt Play-Rate: `speedMs` ist die reale Zeit pro Frame-Schritt.
  // Rate = stepMinutes*60000 timeline-ms pro speedMs real-ms.
  const rateRef = useRef<number>(1);
  useEffect(() => {
    const stepMs = region.stepMinutes * 60_000;
    rateRef.current = stepMs / speedMs;
  }, [region.stepMinutes, speedMs]);

  // Beim Wechsel der Frames Position bestimmen (bei erstem Load: neuestes Bild).
  useEffect(() => {
    if (frames.length === 0) return;
    let idx = frames.length - 1;
    if (lastTimeRef.current) {
      const found = frames.findIndex((f) => f.time === lastTimeRef.current);
      if (found >= 0) idx = found;
    }
    renderMsRef.current = Date.parse(frames[idx].time);
    lastTimeRef.current = frames[idx].time;
    setUiIndex(idx);
    // imperatives Erst-Paint (falls Refs schon da sind)
    filmstripRef.current?.setTime(renderMsRef.current);
    stackRef.current?.setTimeMs(renderMsRef.current);
  }, [frames]);

  // Regionwechsel: Loading/Play zurücksetzen.
  useEffect(() => {
    setLoaded(0);
    setPlaying(false);
    lastTimeRef.current = null;
  }, [regionId]);

  // Autoplay sobald genug geladen ist.
  useEffect(() => {
    if (ready && !playing && total >= 2) setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Play-Loop per requestAnimationFrame — kontinuierliche Zeit, keine React-
  // Renders pro Frame. Autoplay startet erst nach vollständigem Preload; der
  // Loop selbst hält nicht mehr an Tile-Readiness an und erzeugt daher keine
  // Geschwindigkeitsschwankungen.
  const uiIndexLastWriteRef = useRef(0);
  useEffect(() => {
    if (!playing || total < 2 || !ready) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      let next = renderMsRef.current + dt * rateRef.current;
      if (next > tMax) next = tMin + (next - tMax); // wrap
      if (next < tMin) next = tMin;

      renderMsRef.current = next;
      filmstripRef.current?.setTime(next);
      stackRef.current?.setTimeMs(next);

      // uiIndex diskret & gedrosselt aktualisieren (max alle 150 ms).
      if (now - uiIndexLastWriteRef.current > 150) {
        let iNear = 0;
        let bestDt = Infinity;
        for (let i = 0; i < times.length; i++) {
          const d = Math.abs(times[i] - next);
          if (d < bestDt) { bestDt = d; iNear = i; }
        }
        uiIndexLastWriteRef.current = now;
        setUiIndex((prev) => (prev === iNear ? prev : iNear));
        lastTimeRef.current = frames[iNear]?.time ?? lastTimeRef.current;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, ready, tMin, tMax, times, frames]);

  // Space = Play/Pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) void el.requestFullscreen?.();
    else void document.exitFullscreen?.();
  }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const layer = data?.layer ?? region.layer;

  // Scrub-Handler vom Filmstrip
  const handleScrubMs = useCallback(
    (ms: number, commit: boolean) => {
      if (playing) setPlaying(false);
      renderMsRef.current = ms;
      stackRef.current?.setTimeMs(ms);
      if (commit) {
        // Snap uiIndex / lastTimeRef auf nächstgelegenen Frame (für Persistenz beim Refetch)
        let iNear = 0;
        let bestDt = Infinity;
        for (let i = 0; i < times.length; i++) {
          const d = Math.abs(times[i] - ms);
          if (d < bestDt) { bestDt = d; iNear = i; }
        }
        setUiIndex(iNear);
        lastTimeRef.current = frames[iNear]?.time ?? null;
      }
    },
    [playing, times, frames],
  );

  // Prev/Next-Buttons: diskreter Sprung
  const stepTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      const ms = times[clamped] ?? tMin;
      setPlaying(false);
      renderMsRef.current = ms;
      setUiIndex(clamped);
      lastTimeRef.current = frames[clamped]?.time ?? null;
      filmstripRef.current?.setTime(ms);
      stackRef.current?.setTimeMs(ms);
    },
    [total, times, frames, tMin],
  );

  const showSwiss = regionId === "alpen-ch";

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card shadow-sm",
        bare && "h-full rounded-none border-0 shadow-none",
      )}
    >
      {/* Top bar */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-neutral-200/80 bg-white/90 p-0.5 shadow-sm backdrop-blur">
            {SATELLITE_REGIONS.map((r) => {
              const active = r.id === regionId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegionId(r.id)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 h-8 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2",
                    active ? "text-white shadow-sm" : "text-neutral-700 hover:bg-neutral-100",
                  )}
                  style={
                    active
                      ? { background: BRAND, ['--tw-ring-color' as never]: BRAND }
                      : { ['--tw-ring-color' as never]: BRAND }
                  }
                  aria-pressed={active}
                >
                  {r.shortLabel}
                </button>
              );
            })}
          </div>
          {!ready && total > 0 && (
            <div className="hidden sm:inline-flex items-center rounded-full border border-neutral-200/80 bg-white/90 px-3 h-8 text-xs font-medium shadow-sm backdrop-blur">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              {loaded}/{total}
            </div>
          )}
        </div>
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200/80 bg-white/90 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2"
            style={{ ['--tw-ring-color' as never]: BRAND }}
            title={isFullscreen ? "Vollbild verlassen" : "Vollbild"}
            aria-label={isFullscreen ? "Vollbild verlassen" : "Vollbild"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className={cn("relative", bare ? "h-full min-h-[400px]" : "h-[620px]")}>
        <MapContainer
          center={region.center}
          zoom={region.zoom}
          minZoom={region.zoom}
          maxZoom={region.zoom}
          zoomControl={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          dragging={false}
          worldCopyJump
          className="satellite-map-container absolute inset-0 z-0 bg-black"
        >
          <FlyToRegion regionId={regionId} />
          {frames.length > 0 && (
            <FrameStack
              key={`${regionId}-${layer}`}
              ref={stackRef}
              layer={layer}
              frames={frames}
              initialIso={selectedIso}
              onProgress={handleStackProgress}
            />
          )}
          {showSwiss && <SwissOutline />}
        </MapContainer>

        {isLoading && total === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && total === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/80">
            <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Satellitenbilder vorübergehend nicht verfügbar.
            </div>
          </div>
        )}

        {/* Steuerpanel — analog Radar */}
        {total > 0 && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3">
            <div className="pointer-events-auto rounded-xl border border-neutral-200/80 bg-white/90 p-2 text-neutral-900 shadow-lg backdrop-blur sm:p-2.5">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  disabled={!ready}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 sm:h-7 sm:w-7"
                  style={{ background: BRAND, borderColor: BRAND, ['--tw-ring-color' as never]: BRAND }}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Play className="h-4 w-4 translate-x-px sm:h-3.5 sm:w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => stepTo(uiIndex - 1)}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Vorheriger Frame"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <SatelliteFilmstrip
                    ref={filmstripRef}
                    tMin={tMin}
                    tMax={tMax}
                    isMobile={isMobile}
                    playing={playing}
                    onScrubMs={handleScrubMs}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => stepTo(uiIndex + 1)}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Nächster Frame"
                >
                  <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                      aria-label="Wiedergabe-Einstellungen"
                    >
                      <Settings className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    collisionPadding={12}
                    className="z-[1000] w-56 border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl"
                  >
                    <p className="mb-1.5 text-[11px] font-semibold text-neutral-600">
                      Geschwindigkeit
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SPEEDS.map((s) => {
                        const active = s.ms === speedMs;
                        return (
                          <button
                            key={s.ms}
                            type="button"
                            onClick={() => setSpeedMs(s.ms)}
                            className={cn(
                              "rounded-full px-3 h-7 text-xs font-medium transition",
                              active
                                ? "text-white"
                                : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                            )}
                            style={active ? { background: BRAND } : undefined}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
