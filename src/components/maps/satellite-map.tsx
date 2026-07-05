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
import { FilmstripTimeline } from "./filmstrip-timeline";

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
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
 * Mountet zuerst nur den aktiven Frame, dann inkrementell die übrigen
 * (radial vom aktiven Index aus).
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
        'Oberthurgauer Wetter · © <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, effectiveLayer, frames]);

  useEffect(() => {
    layersRef.current.forEach((tl, i) => tl?.setOpacity(i === activeIndex ? 1 : 0));
  }, [activeIndex]);

  return null;
}

// ---------- Timeline ----------
// SatelliteTimeline wurde durch die geteilte FilmstripTimeline ersetzt.

function fmtBubble(d: Date): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wd}, ${hh}:${mm}`;
}


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

      </div>

      {/* Steuerpanel — bare: schwebend über der Karte; sonst Panel unter der Karte (analog Radar) */}
      {total > 0 && (
        <div
          className={cn(
            bare
              ? "pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3"
              : "w-full",
          )}
        >
          <div
            className={cn(
              "rounded-xl border border-neutral-200 p-2 text-neutral-900 sm:p-2.5",
              bare
                ? "pointer-events-auto bg-white/90 shadow-lg backdrop-blur"
                : "bg-white shadow-sm",
            )}
          >
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
                  <FilmstripTimeline
                    frames={frames.map((f) => ({ ms: Date.parse(f.time) }))}
                    idx={index}
                    onChange={handleTimelineChange}
                    isMobile={isMobile}
                    playing={playing}
                    color={BRAND}
                    bandMode="measurement-only"
                    ariaLabel="Satellit-Zeit"
                    formatBubble={fmtBubble}
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
