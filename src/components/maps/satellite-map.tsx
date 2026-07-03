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

// ---------- Frame-Stack mit kontinuierlicher Cross-Fade-Interpolation ----------

type FrameStackHandle = {
  /** Setzt die aktuell darzustellende Zeit (ms). Blendet zwischen den beiden
   *  benachbarten WMS-Frames kontinuierlich über. */
  setTimeMs: (ms: number) => void;
};

const FrameStack = forwardRef<
  FrameStackHandle,
  {
    layer: string;
    fallbackLayer?: string;
    frames: SatelliteFrame[];
    initialIndex: number;
    onProgress: (loaded: number, total: number) => void;
  }
>(function FrameStack(
  { layer, fallbackLayer, frames, initialIndex, onProgress },
  ref,
) {
  const map = useMap();
  const layersRef = useRef<(L.TileLayer.WMS | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const [effectiveLayer, setEffectiveLayer] = useState(layer);
  const triedFallbackRef = useRef(false);
  const times = useMemo(() => frames.map((f) => Date.parse(f.time)), [frames]);
  const timesRef = useRef(times);
  useEffect(() => {
    timesRef.current = times;
  }, [times]);
  // Zuletzt aktive Frame-Paar-Indizes; damit vermeiden wir das Iterieren
  // über alle Layer pro RAF-Tick.
  const lastPairRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    setEffectiveLayer(layer);
    triedFallbackRef.current = false;
  }, [layer]);

  useEffect(() => {
    loadedRef.current = new Set();
    layersRef.current = new Array(frames.length).fill(null);
    lastPairRef.current = null;

    const opts: L.WMSOptions & { keepBuffer?: number; updateWhenZooming?: boolean } = {
      layers: effectiveLayer,
      format: "image/jpeg",
      transparent: false,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      tileSize: 512,
      keepBuffer: 0,
      updateWhenZooming: false,
      attribution:
        'Oberthurgauer Wetter · © <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
    };

    const mountFrame = (i: number) => {
      if (i < 0 || i >= frames.length || layersRef.current[i]) return;
      const f = frames[i];
      const tl = L.tileLayer.wms(WMS_URL, { ...opts, opacity: i === initialIndex ? 1 : 0 });
      tl.setParams({ time: f.time } as unknown as L.WMSParams, false);
      tl.on("load", () => {
        if (!loadedRef.current.has(i)) {
          loadedRef.current.add(i);
          onProgress(loadedRef.current.size, frames.length);
        }
      });
      tl.on("tileerror", () => {
        if (!triedFallbackRef.current && fallbackLayer && fallbackLayer !== effectiveLayer) {
          triedFallbackRef.current = true;
          setEffectiveLayer(fallbackLayer);
        }
      });
      tl.addTo(map);
      layersRef.current[i] = tl;
    };

    mountFrame(initialIndex);
    onProgress(0, frames.length);

    let cancelled = false;
    const order: number[] = [];
    for (let d = 1; d < frames.length; d++) {
      const a = initialIndex + d;
      const b = initialIndex - d;
      if (a < frames.length) order.push(a);
      if (b >= 0) order.push(b);
    }
    const timers: number[] = [];
    order.forEach((i, k) => {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        mountFrame(i);
      }, 80 + k * 40);
      timers.push(t);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      layersRef.current.forEach((tl) => tl?.remove());
      layersRef.current = [];
      lastPairRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, effectiveLayer, frames]);

  useImperativeHandle(
    ref,
    () => ({
      setTimeMs: (ms: number) => {
        const t = timesRef.current;
        if (t.length === 0) return;
        // iPrev = letzter Frame mit times[i] <= ms; iNext = iPrev+1 (oder gleich)
        let iPrev = 0;
        // binäre Suche
        let lo = 0;
        let hi = t.length - 1;
        if (ms <= t[0]) {
          iPrev = 0;
        } else if (ms >= t[hi]) {
          iPrev = hi;
        } else {
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (t[mid] <= ms) lo = mid;
            else hi = mid - 1;
          }
          iPrev = lo;
        }
        const iNext = Math.min(iPrev + 1, t.length - 1);
        const dt = t[iNext] - t[iPrev];
        let a = dt > 0 ? (ms - t[iPrev]) / dt : 0;
        if (a < 0) a = 0;
        else if (a > 1) a = 1;
        // smoothstep gegen Flackern
        const alpha = a * a * (3 - 2 * a);

        const layers = layersRef.current;
        const last = lastPairRef.current;
        // Alte Paar-Layer auf 0 setzen, sofern sie nicht Teil des neuen Paars sind.
        if (last) {
          for (const idx of last) {
            if (idx !== iPrev && idx !== iNext) {
              const l = layers[idx];
              if (l) l.setOpacity(0);
            }
          }
        }
        const lp = layers[iPrev];
        const ln = layers[iNext];
        if (iPrev === iNext) {
          if (lp) lp.setOpacity(1);
        } else {
          if (lp) lp.setOpacity(1 - alpha);
          if (ln) ln.setOpacity(alpha);
        }
        lastPairRef.current = [iPrev, iNext];
      },
    }),
    [],
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

  const total = frames.length;
  const ready = total > 0 && loaded / total >= 0.5;

  // Kontinuierliche Zeit als Single Source of Truth.
  const renderMsRef = useRef<number>(0);
  const filmstripRef = useRef<FilmstripHandle | null>(null);
  const stackRef = useRef<FrameStackHandle | null>(null);

  // Übersetzt Play-Rate: `speedMs` ist die reale Zeit pro Frame-Schritt.
  // Rate = stepMinutes*60000 timeline-ms pro speedMs real-ms.
  const rateRef = useRef<number>(1);
  useEffect(() => {
    const stepMs = region.stepMinutes * 60_000;
    rateRef.current = stepMs / speedMs;
  }, [region.stepMinutes, speedMs]);

  const lastTimeRef = useRef<string | null>(null);
  const initialIndexRef = useRef<number>(0);

  // Beim Wechsel der Frames Position bestimmen (bei erstem Load: neuestes Bild).
  useEffect(() => {
    if (frames.length === 0) return;
    let idx = frames.length - 1;
    if (lastTimeRef.current) {
      const found = frames.findIndex((f) => f.time === lastTimeRef.current);
      if (found >= 0) idx = found;
    }
    initialIndexRef.current = idx;
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

  // Play-Loop per requestAnimationFrame — kontinuierliche Zeit, keine React-Renders pro Frame.
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
      // uiIndex diskret nur bei Wechsel aktualisieren (drosselt Re-Renders)
      // -> nächster Frame-Index
      let iNear = 0;
      let bestDt = Infinity;
      for (let i = 0; i < times.length; i++) {
        const d = Math.abs(times[i] - next);
        if (d < bestDt) { bestDt = d; iNear = i; }
      }
      setUiIndex((prev) => (prev === iNear ? prev : iNear));
      lastTimeRef.current = frames[iNear]?.time ?? lastTimeRef.current;
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
          className="absolute inset-0 z-0 bg-black"
        >
          <FlyToRegion regionId={regionId} />
          {frames.length > 0 && (
            <FrameStack
              key={`${regionId}-${layer}-${frames.length}-${frames[0]?.time}`}
              ref={stackRef}
              layer={layer}
              fallbackLayer={data?.fallbackLayer ?? region.fallbackLayer}
              frames={frames}
              initialIndex={initialIndexRef.current}
              onProgress={(l) => setLoaded(l)}
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
