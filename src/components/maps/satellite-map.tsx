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
  Zap,
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
import { getLightningStrikes, type LightningStrike } from "@/lib/lightning.functions";
import { FilmstripTimeline } from "./filmstrip-timeline";


const WMS_URL = "https://view.eumetsat.int/geoserver/wms";
const BRAND = "#2561a1";
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

// Supersampling: fragt beim GeoServer immer die doppelte Pixelauflösung
// an und lässt Leaflet per CSS auf tileSize skalieren. Verbessert die
// Kantenqualität auch bei devicePixelRatio = 1.
const HiDpiWMS = L.TileLayer.WMS.extend({
  getTileUrl(coords: L.Coords) {
    const url = L.TileLayer.WMS.prototype.getTileUrl.call(this, coords);
    const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 2) : 2;
    const size = (this.options as L.WMSOptions).tileSize as number;
    const hi = Math.round(size * Math.min(dpr, 2));
    return url
      .replace(/([?&])WIDTH=\d+/i, `$1WIDTH=${hi}`)
      .replace(/([?&])HEIGHT=\d+/i, `$1HEIGHT=${hi}`);
  },
});
const hiDpiWms = (url: string, options: L.WMSOptions) =>
  new (HiDpiWMS as unknown as new (u: string, o: L.WMSOptions) => L.TileLayer.WMS)(url, options);
const WEEKDAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const SPEEDS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "2×", ms: 250 },
  { label: "4×", ms: 125 },
];

// Schweiz-Bounds inkl. kleinem Puffer (Bodensee, Genfersee, Tessin sichtbar).
const CH_BOUNDS: L.LatLngBoundsLiteral = [
  [45.75, 5.9],
  [47.85, 10.55],
];
const CH_CENTER: [number, number] = [46.8, 8.23];

function FlyToRegion({ regionId, fitBounds }: { regionId: SatelliteRegionId; fitBounds?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (fitBounds) {
      const apply = () => {
        map.invalidateSize();
        const bounds = L.latLngBounds(CH_BOUNDS);
        // Padding in px, damit die Schweiz nicht am Rand klebt.
        const raw = map.getBoundsZoom(bounds, true, L.point(12, 12));
        const z = Math.max(5, Math.min(9, Math.floor(raw)));
        map.setMinZoom(z);
        map.setMaxZoom(z);
        map.setView(CH_CENTER, z, { animate: false });
      };
      apply();
      const container = map.getContainer();
      let raf = 0;
      const ro = new ResizeObserver(() => {
        window.clearTimeout(raf);
        raf = window.setTimeout(apply, 150) as unknown as number;
      });
      ro.observe(container);
      return () => {
        ro.disconnect();
        window.clearTimeout(raf);
      };
    }
    const r = getRegion(regionId);
    map.setMinZoom(r.zoom);
    map.setMaxZoom(r.zoom);
    map.setView(r.center, r.zoom, { animate: true });
  }, [regionId, map, fitBounds]);
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

function LightningLayer({ strikes }: { strikes: LightningStrike[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const pane = map.getPane("lightning") ?? map.createPane("lightning");
    pane.style.zIndex = "650";
    pane.style.pointerEvents = "none";
    const group = L.layerGroup([], { pane: "lightning" });
    group.addTo(map);
    layerRef.current = group;
    return () => {
      group.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;

    let stopped = false;
    const render = () => {
      if (stopped || !layerRef.current) return;
      const now = Date.now();
      group.clearLayers();
      for (const s of strikes) {
        const t = Date.parse(s.t);
        if (!Number.isFinite(t)) continue;
        const ageMs = now - t;
        if (ageMs < 0 || ageMs > 15 * 60_000) continue;
        const ageMin = ageMs / 60_000;
        let color: string;
        let radius: number;
        let opacity: number;
        let glowColor: string;
        if (ageMin < 2) {
          color = "#fffbe0";
          glowColor = "#fde047";
          radius = 6;
          opacity = 1;
        } else if (ageMin < 8) {
          color = "#fbbf24";
          glowColor = "#f59e0b";
          radius = 5;
          opacity = 0.85 - ((ageMin - 2) / 6) * 0.5; // 0.85 → 0.35
        } else {
          color = "#b91c1c";
          glowColor = "#7f1d1d";
          radius = 3.5;
          opacity = 0.35 - ((ageMin - 8) / 7) * 0.25; // 0.35 → 0.10
        }
        opacity = Math.max(0.08, Math.min(1, opacity));

        // Halo (Glow)
        L.circleMarker([s.lat, s.lon], {
          pane: "lightning",
          radius: radius + 4,
          stroke: false,
          fill: true,
          fillColor: glowColor,
          fillOpacity: opacity * 0.25,
          interactive: false,
        }).addTo(group);
        // Kern
        L.circleMarker([s.lat, s.lon], {
          pane: "lightning",
          radius,
          stroke: true,
          color,
          weight: 1,
          fill: true,
          fillColor: color,
          fillOpacity: opacity,
          interactive: false,
        }).addTo(group);
      }
      rafRef.current = window.setTimeout(() => {
        rafRef.current = window.requestAnimationFrame(render);
      }, 1000) as unknown as number;
    };
    render();
    return () => {
      stopped = true;
      if (rafRef.current !== null) {
        window.clearTimeout(rafRef.current);
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [strikes]);

  return null;
}


/**
 * Mountet zuerst nur den aktiven Frame, dann inkrementell die übrigen
 * (radial vom aktiven Index aus).
 */
function FrameStack({
  provider,
  layer,
  fallbackLayer,
  tileMatrixSet,
  frames,
  activeIndex,
  initialIndex,
  onProgress,
}: {
  provider: "eumetsat-wms" | "gibs-wmts";
  layer: string;
  fallbackLayer?: string;
  tileMatrixSet?: string;
  frames: SatelliteFrame[];
  activeIndex: number;
  initialIndex: number;
  onProgress: (loaded: number, total: number) => void;
}) {
  const map = useMap();
  const layersRef = useRef<(L.TileLayer | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const [effectiveLayer, setEffectiveLayer] = useState(layer);
  const triedFallbackRef = useRef(false);
  const clampedActiveIndex = frames.length > 0 ? Math.min(Math.max(activeIndex, 0), frames.length - 1) : 0;
  const clampedInitialIndex = frames.length > 0 ? Math.min(Math.max(initialIndex, 0), frames.length - 1) : 0;

  useEffect(() => {
    setEffectiveLayer(layer);
    triedFallbackRef.current = false;
  }, [layer]);

  useEffect(() => {
    loadedRef.current = new Set();
    layersRef.current = new Array(frames.length).fill(null);

    const wmsOpts: L.WMSOptions & { keepBuffer?: number; updateWhenZooming?: boolean; format_options?: string } = {
      layers: effectiveLayer,
      format: "image/jpeg",
      transparent: false,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      tileSize: 512,
      keepBuffer: 0,
      updateWhenZooming: false,
      format_options: "antialias:full;interpolation:bicubic",
      attribution:
        'Oberthurgauer Wetter · © <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
    };

    const gibsOpts: L.TileLayerOptions = {
      tileSize: 256,
      minZoom: 1,
      maxZoom: 9,
      attribution:
        'Oberthurgauer Wetter · © <a href="https://earthdata.nasa.gov/" target="_blank" rel="noopener">NASA GIBS</a> · VIIRS NOAA-20',
    };

    const mountFrame = (i: number) => {
      if (i < 0 || i >= frames.length || layersRef.current[i]) return;
      const f = frames[i];
      let tl: L.TileLayer;
      if (provider === "gibs-wmts") {
        const tms = tileMatrixSet ?? "GoogleMapsCompatible_Level9";
        const url =
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${effectiveLayer}` +
          `/default/${f.time}/${tms}/{z}/{y}/{x}.jpg`;
        tl = L.tileLayer(url, { ...gibsOpts, opacity: i === clampedActiveIndex ? 1 : 0 });
      } else {
        const wl = hiDpiWms(WMS_URL, { ...wmsOpts, opacity: i === clampedActiveIndex ? 1 : 0 });
        wl.setParams({ time: f.time } as unknown as L.WMSParams, false);
        tl = wl;
      }
      tl.on("load", () => {
        if (!loadedRef.current.has(i)) {
          loadedRef.current.add(i);
          onProgress(loadedRef.current.size, frames.length);
        }
      });
      tl.on("tileerror", () => {
        if (triedFallbackRef.current) return;
        if (provider === "eumetsat-wms" && fallbackLayer && fallbackLayer !== effectiveLayer) {
          triedFallbackRef.current = true;
          setEffectiveLayer(fallbackLayer);
        } else if (provider === "gibs-wmts" && effectiveLayer !== "MODIS_Terra_CorrectedReflectance_TrueColor") {
          triedFallbackRef.current = true;
          setEffectiveLayer("MODIS_Terra_CorrectedReflectance_TrueColor");
        }
      });
      tl.addTo(map);
      layersRef.current[i] = tl;
    };

    mountFrame(clampedInitialIndex);
    onProgress(0, frames.length);

    let cancelled = false;
    const order: number[] = [];
    for (let d = 1; d < frames.length; d++) {
      const a = clampedInitialIndex + d;
      const b = clampedInitialIndex - d;
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
  }, [map, provider, effectiveLayer, tileMatrixSet, frames, clampedInitialIndex]);

  useEffect(() => {
    layersRef.current.forEach((tl, i) => tl?.setOpacity(i === clampedActiveIndex ? 1 : 0));
  }, [clampedActiveIndex]);

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


export function SatelliteMap({ bare = false, loop = false }: { bare?: boolean; loop?: boolean } = {}) {
  const [regionId, setRegionId] = useState<SatelliteRegionId>("alpen-ch");
  const region = useMemo(() => getRegion(regionId), [regionId]);
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["satellite-manifest", regionId],
    queryFn: () => getSatelliteManifest({ data: { region: regionId } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const [showLightning, setShowLightning] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sat.lightning") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sat.lightning", showLightning ? "1" : "0");
  }, [showLightning]);
  const { data: lightningData } = useQuery({
    queryKey: ["lightning"],
    queryFn: () => getLightningStrikes(),
    enabled: showLightning,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const lightningStrikes = useMemo(() => lightningData?.strikes ?? [], [lightningData]);


  const frames = useMemo(() => data?.frames ?? [], [data]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const total = frames.length;
  const ready = total > 0 && loaded >= 1;

  const lastTimeRef = useRef<string | null>(null);
  const initialIndexRef = useRef<number>(0);
  const safeIndex = total > 0 ? Math.min(Math.max(index, 0), total - 1) : 0;
  const safeInitialIndex = total > 0 ? Math.min(Math.max(initialIndexRef.current, 0), total - 1) : 0;
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
    if (total === 0 || index === safeIndex) return;
    setIndex(safeIndex);
    lastTimeRef.current = frames[safeIndex]?.time ?? null;
    initialIndexRef.current = safeIndex;
  }, [frames, index, safeIndex, total]);

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
      {!loop && (
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
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowLightning((v) => !v)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur transition focus-visible:outline-none focus-visible:ring-2",
              showLightning
                ? "border-amber-300 bg-amber-400 text-white hover:bg-amber-500"
                : "border-neutral-200/80 bg-white/90 text-neutral-700 hover:bg-neutral-100",
            )}
            style={{ ['--tw-ring-color' as never]: BRAND }}
            title={showLightning ? "Blitze ausblenden" : "Blitze einblenden"}
            aria-label={showLightning ? "Blitze ausblenden" : "Blitze einblenden"}
            aria-pressed={showLightning}
          >
            <Zap className="h-4 w-4" />
          </button>
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
      )}

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
              provider={data?.provider ?? region.provider ?? "eumetsat-wms"}
              layer={layer}
              fallbackLayer={data?.fallbackLayer ?? region.fallbackLayer}
              tileMatrixSet={data?.tileMatrixSet ?? region.tileMatrixSet}
              frames={frames}
              activeIndex={safeIndex}
              initialIndex={safeInitialIndex}
              onProgress={(l) => setLoaded(l)}
            />
          )}
          {showSwiss && <SwissOutline />}
          {showLightning && <LightningLayer strikes={lightningStrikes} />}
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
      {!loop && total > 0 && (

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
                  onClick={() => handleTimelineChange(Math.max(safeIndex - 1, 0))}
                  className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                  aria-label="Vorheriger Frame"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <FilmstripTimeline
                    frames={frames.map((f) => ({ ms: Date.parse(f.time) }))}
                    idx={safeIndex}
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
                  onClick={() => handleTimelineChange(Math.min(safeIndex + 1, total - 1))}
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
  );
}

