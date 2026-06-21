import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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


const BRAND = "#2561a1";
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;
const WEEKDAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

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
      style={{
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.9,
        fill: false,
        interactive: false,
      }}
    />
  );
}

/**
 * Mountet pro Frame EIN ImageOverlay (ein einziger GetMap-Request via
 * unseren cachenden Edge-Proxy /api/public/satellite/frame).
 * Aktiver Frame wird sofort gemountet, übrige radial mit Versatz.
 */
function FrameStack({
  layer,
  fallbackLayer,
  frames,
  bbox,
  pixelSize,
  activeIndex,
  initialIndex,
  onProgress,
  onActiveReady,
}: {
  layer: string;
  fallbackLayer?: string;
  frames: SatelliteFrame[];
  bbox: [number, number, number, number];
  pixelSize: { w: number; h: number };
  activeIndex: number;
  initialIndex: number;
  onProgress: (loaded: number, total: number) => void;
  onActiveReady: () => void;
}) {
  const map = useMap();
  const layersRef = useRef<(L.ImageOverlay | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const [effectiveLayer, setEffectiveLayer] = useState(layer);
  const triedFallbackRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    setEffectiveLayer(layer);
    triedFallbackRef.current = false;
  }, [layer]);

  useEffect(() => {
    loadedRef.current = new Set();
    layersRef.current = new Array(frames.length).fill(null);

    const [west, south, east, north] = bbox;
    const bounds = L.latLngBounds([south, west], [north, east]);

    const frameUrl = (time: string) => {
      const p = new URLSearchParams({
        layer: effectiveLayer,
        time,
        west: String(west),
        south: String(south),
        east: String(east),
        north: String(north),
        w: String(pixelSize.w),
        h: String(pixelSize.h),
      });
      return `/api/public/satellite/frame?${p.toString()}`;
    };

    const mountFrame = (i: number) => {
      if (i < 0 || i >= frames.length || layersRef.current[i]) return;
      const f = frames[i];
      const ov = L.imageOverlay(frameUrl(f.time), bounds, {
        opacity: i === activeIndexRef.current ? 1 : 0,
        interactive: false,
        crossOrigin: true,
        attribution:
          '© <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
      });
      ov.on("load", () => {
        if (!loadedRef.current.has(i)) {
          loadedRef.current.add(i);
          onProgress(loadedRef.current.size, frames.length);
          if (i === activeIndexRef.current) onActiveReady();
        }
      });
      ov.on("error", () => {
        if (!triedFallbackRef.current && fallbackLayer && fallbackLayer !== effectiveLayer) {
          triedFallbackRef.current = true;
          setEffectiveLayer(fallbackLayer);
        }
      });
      ov.addTo(map);
      layersRef.current[i] = ov;
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
      }, 60 + k * 30);
      timers.push(t);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      layersRef.current.forEach((ov) => ov?.remove());
      layersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, effectiveLayer, frames, bbox, pixelSize.w, pixelSize.h]);

  useEffect(() => {
    layersRef.current.forEach((ov, i) => ov?.setOpacity(i === activeIndex ? 1 : 0));
  }, [activeIndex]);

  return null;
}

// ---------- Timeline (analog MeteoTimeline) ----------

function fmtDayLong(d: Date): string {
  const wd = WEEKDAY_LONG[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}.${mm}.${d.getFullYear()}`;
}

function fmtBubble(d: Date): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wd}, ${hh}:${mm}`;
}

function SatelliteTimeline({
  frames,
  idx,
  onChange,
  isMobile,
}: {
  frames: SatelliteFrame[];
  idx: number;
  onChange: (i: number) => void;
  isMobile: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const times = useMemo(() => frames.map((f) => Date.parse(f.time)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const span = Math.max(1, tMax - tMin);

  const pctForMs = (ms: number) => Math.max(0, Math.min(100, ((ms - tMin) / span) * 100));
  const pctForIdx = (i: number) => pctForMs(times[i] ?? tMin);

  const idxFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return idx;
    const r = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const target = tMin + pct * span;
    let best = 0;
    let bestDt = Infinity;
    for (let i = 0; i < times.length; i++) {
      const dt = Math.abs(times[i] - target);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    return best;
  };

  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);
  const flushPending = () => {
    rafRef.current = null;
    const x = pendingXRef.current;
    pendingXRef.current = null;
    if (x != null) onChange(idxFromClientX(x));
  };
  const cancelPending = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingXRef.current = null;
  };
  useEffect(() => () => cancelPending(), []);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(8); } catch { /* ignore */ }
    }
    onChange(idxFromClientX(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    pendingXRef.current = e.clientX;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushPending);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    cancelPending();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
  };

  const hourTicks = useMemo(() => {
    const startMs = Math.ceil(tMin / 3600000) * 3600000;
    const out: { ms: number; pct: number; hour: number }[] = [];
    for (let t = startMs; t <= tMax; t += 3600000) {
      const d = new Date(t);
      out.push({ ms: t, pct: pctForMs(t), hour: d.getHours() });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax]);

  const dayBreaks = hourTicks.filter((t) => t.hour === 0);

  const daySegments = useMemo(() => {
    const breaks = [tMin, ...dayBreaks.map((b) => b.ms), tMax];
    const segs: { startPct: number; endPct: number; label: string }[] = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      const a = breaks[i];
      const b = breaks[i + 1];
      if (b <= a) continue;
      const mid = new Date((a + b) / 2);
      segs.push({ startPct: pctForMs(a), endPct: pctForMs(b), label: fmtDayLong(mid) });
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax, dayBreaks.length]);

  const handlePct = pctForIdx(idx);
  const currentMs = times[idx] ?? tMax;
  const bubbleLabel = fmtBubble(new Date(currentMs));
  const labelStep = isMobile ? 3 : 1;

  return (
    <div className="select-none">
      <div className="relative pt-5 pb-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4">
          {hourTicks.map((t, i) => {
            if (i % labelStep !== 0) return null;
            return (
              <span
                key={`hl-${t.ms}`}
                className="absolute -translate-x-1/2 text-[9px] font-medium tabular-nums text-neutral-500"
                style={{ left: `${t.pct}%`, top: 0 }}
              >
                {String(t.hour).padStart(2, "0")}
              </span>
            );
          })}
        </div>

        <div
          ref={trackRef}
          role="slider"
          aria-label="Satellit-Zeit"
          aria-valuemin={0}
          aria-valuemax={frames.length - 1}
          aria-valuenow={idx}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              onChange(Math.max(0, idx - 1));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              onChange(Math.min(frames.length - 1, idx + 1));
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative flex h-7 w-full cursor-pointer touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded sm:h-6"
          style={{ ['--tw-ring-color' as never]: BRAND }}
        >
          <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="absolute inset-y-0 left-0 right-0"
              style={{ background: BRAND, opacity: 0.25 }}
            />
            {hourTicks.map((t) => (
              <span
                key={`ht-${t.ms}`}
                className="absolute top-0 h-full w-px bg-neutral-300"
                style={{ left: `${t.pct}%` }}
              />
            ))}
          </div>

          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="pointer-events-none absolute inset-y-0 w-px bg-neutral-300"
              style={{ left: `${b.pct}%` }}
            />
          ))}

          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${handlePct}%` }}
          >
            <div className="relative h-6 w-[2px] rounded-sm bg-neutral-900/70">
              <div
                className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md before:absolute before:-inset-3 before:content-['']"
                style={{ background: BRAND }}
              />
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span
                className="whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                style={{ background: BRAND }}
              >
                {bubbleLabel}
              </span>
              <span
                className="h-0 w-0"
                style={{
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: `4px solid ${BRAND}`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
          {daySegments.map((s, i) => {
            const width = Math.max(0, s.endPct - s.startPct);
            if (width < (isMobile ? 18 : 10)) return null;
            return (
              <span
                key={`ds-${i}`}
                className="absolute top-0 text-[10px] font-medium text-neutral-600 truncate"
                style={{ left: `${s.startPct}%`, width: `${width}%`, textAlign: "center" }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [activeReady, setActiveReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [pixelSize, setPixelSize] = useState<{ w: number; h: number }>({ w: 1024, h: 700 });

  const total = frames.length;
  const ready = activeReady;

  const lastTimeRef = useRef<string | null>(null);
  const initialIndexRef = useRef<number>(0);
  useEffect(() => {
    if (frames.length === 0) return;
    if (lastTimeRef.current === null) {
      const last = frames.length - 1;
      setIndex(last);
      initialIndexRef.current = last;
      lastTimeRef.current = frames[last].time;
      return;
    }
    const idx = frames.findIndex((f) => f.time === lastTimeRef.current);
    if (idx >= 0) {
      setIndex(idx);
      initialIndexRef.current = idx;
    } else {
      const last = frames.length - 1;
      setIndex(last);
      initialIndexRef.current = last;
      lastTimeRef.current = frames[last].time;
    }
  }, [frames]);

  useEffect(() => {
    setLoaded(0);
    setActiveReady(false);
    setPlaying(false);
  }, [regionId]);

  // Container-Grösse messen → bestimmt Bildauflösung des Frame-Proxys
  useEffect(() => {
    const el = mapBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const apply = () => {
      const w = Math.max(320, Math.min(1600, Math.round(el.clientWidth * dpr)));
      const h = Math.max(240, Math.min(1600, Math.round(el.clientHeight * dpr)));
      // Auf 64-er Raster runden, damit Edge-Cache trifft (gleicher URL für ähnliche Grössen)
      const snap = (n: number) => Math.round(n / 64) * 64;
      setPixelSize((prev) => {
        const next = { w: snap(w), h: snap(h) };
        if (prev.w === next.w && prev.h === next.h) return prev;
        return next;
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (ready && !playing && total >= 2) setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!playing || total < 2 || !ready) return;
    const t = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % total;
        lastTimeRef.current = frames[next]?.time ?? null;
        return next;
      });
    }, speedMs);
    return () => window.clearInterval(t);
  }, [playing, speedMs, total, ready, frames]);

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
  const source = data?.source ?? region.source;
  const handleTimelineChange = useCallback(
    (n: number) => {
      setPlaying(false);
      setIndex(n);
      lastTimeRef.current = frames[n]?.time ?? null;
    },
    [frames],
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
                    active
                      ? "text-white shadow-sm"
                      : "text-neutral-700 hover:bg-neutral-100",
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
              layer={layer}
              fallbackLayer={data?.fallbackLayer ?? region.fallbackLayer}
              frames={frames}
              activeIndex={index}
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

        {/* Quellen-Badge — über dem Steuerpanel */}
        <div className="pointer-events-none absolute bottom-20 left-2 z-[440] rounded bg-black/55 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm sm:bottom-24">
          {source}
        </div>

        {/* Steuerpanel — schwebend unten in der Karte (analog Radar) */}
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
                  onClick={() => handleTimelineChange(Math.max(index - 1, 0))}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Vorheriger Frame"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <SatelliteTimeline
                    frames={frames}
                    idx={index}
                    onChange={handleTimelineChange}
                    isMobile={isMobile}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleTimelineChange(Math.min(index + 1, total - 1))}
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
