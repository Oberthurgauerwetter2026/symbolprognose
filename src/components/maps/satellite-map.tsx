import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  SATELLITE_REGIONS,
  getRegion,
  getSatelliteManifest,
  type SatelliteRegionId,
  type SatelliteFrame,
} from "@/lib/satellite.functions";

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
const BRAND = "#2561a1";
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
    map.flyTo(r.center, r.zoom, { duration: 0.8 });
  }, [regionId, map]);
  return null;
}

/**
 * Mountet zuerst nur den aktiven Frame, dann inkrementell die übrigen
 * (radial vom aktiven Index aus). So sieht der User sofort ein Bild,
 * statt auf alle 18–30 WMS-Layer zu warten.
 */
function FrameStack({
  layer,
  fallbackLayer,
  frames,
  activeIndex,
  initialIndex,
  onProgress,
}: {
  layer: string;
  fallbackLayer?: string;
  frames: SatelliteFrame[];
  activeIndex: number;
  initialIndex: number;
  onProgress: (loaded: number, total: number) => void;
}) {
  const map = useMap();
  const layersRef = useRef<(L.TileLayer.WMS | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const [effectiveLayer, setEffectiveLayer] = useState(layer);
  const triedFallbackRef = useRef(false);

  useEffect(() => {
    setEffectiveLayer(layer);
    triedFallbackRef.current = false;
  }, [layer]);

  useEffect(() => {
    loadedRef.current = new Set();
    layersRef.current = new Array(frames.length).fill(null);

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
        '© <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
    };

    const mountFrame = (i: number) => {
      if (i < 0 || i >= frames.length || layersRef.current[i]) return;
      const f = frames[i];
      const tl = L.tileLayer.wms(WMS_URL, { ...opts, opacity: i === activeIndex ? 1 : 0 });
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

    // Phase 1: aktiven Frame sofort mounten
    mountFrame(initialIndex);
    onProgress(0, frames.length);

    // Phase 2: restliche Frames radial nach außen, jeweils mit kurzem Versatz
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, effectiveLayer, frames]);

  // Active-Index → Opacity-Toggle
  useEffect(() => {
    layersRef.current.forEach((tl, i) => tl?.setOpacity(i === activeIndex ? 1 : 0));
  }, [activeIndex]);

  return null;
}

// ---------- Timeline (analog zu MeteoTimeline in radar-map.tsx) ----------

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
        {/* Stundenlabels über dem Track */}
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
          {/* Track */}
          <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-neutral-200">
            {/* Vergangenheit (gesamter Bereich, brand-Farbe leicht) */}
            <div
              className="absolute inset-y-0 left-0 right-0"
              style={{ background: BRAND, opacity: 0.25 }}
            />
            {/* Hour-Ticks */}
            {hourTicks.map((t) => (
              <span
                key={`ht-${t.ms}`}
                className="absolute top-0 h-full w-px bg-neutral-300"
                style={{ left: `${t.pct}%` }}
              />
            ))}
          </div>

          {/* Day-Break-Linien */}
          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="pointer-events-none absolute inset-y-0 w-px bg-neutral-300"
              style={{ left: `${b.pct}%` }}
            />
          ))}

          {/* Handle */}
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

        {/* Tages-Labels */}
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const total = frames.length;
  const ready = total > 0 && loaded / total >= 0.8;

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
    setPlaying(false);
  }, [regionId]);

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

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card shadow-sm",
        bare && "h-full rounded-none border-0 shadow-none",
      )}
    >
      {/* Top bar */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Select value={regionId} onValueChange={(v) => setRegionId(v as SatelliteRegionId)}>
            <SelectTrigger className="h-9 w-[220px] border bg-background/95 backdrop-blur">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SATELLITE_REGIONS.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!ready && total > 0 && (
            <div className="rounded-md border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Lade {loaded}/{total} …
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-background/95 backdrop-blur"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Vollbild verlassen" : "Vollbild"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className={cn("relative", bare ? "h-full min-h-[400px]" : "h-[620px]")}>
        <MapContainer
          center={region.center}
          zoom={region.zoom}
          minZoom={2}
          maxZoom={9}
          zoomControl={false}
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
          <ZoomControl position="bottomright" />
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

        <div className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-black/55 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {source}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t bg-background/95 px-3 py-3 backdrop-blur sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleTimelineChange(Math.max(index - 1, 0))}
              title="Vorheriger Frame (←)"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9"
              disabled={!ready}
              onClick={() => setPlaying((p) => !p)}
              title={playing ? "Pause (Leertaste)" : "Play (Leertaste)"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleTimelineChange(Math.min(index + 1, total - 1))}
              title="Nächster Frame (→)"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            {total > 0 && (
              <SatelliteTimeline
                frames={frames}
                idx={index}
                onChange={handleTimelineChange}
                isMobile={isMobile}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Speed</span>
            <Select value={String(speedMs)} onValueChange={(v) => setSpeedMs(Number(v))}>
              <SelectTrigger className="h-9 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEEDS.map((s) => (
                  <SelectItem key={s.ms} value={String(s.ms)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
