import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Settings,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SATELLITE_REGIONS,
  getRegion,
  getSatelliteManifest,
  type SatelliteRegionId,
  type SatelliteManifest,
} from "@/lib/satellite.functions";

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";

const SPEEDS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "2×", ms: 250 },
  { label: "4×", ms: 125 },
];

interface Overlays {
  borders: boolean;
  cantons: boolean;
  places: boolean;
  hillshade: boolean;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(d);
}

function formatTimeLong(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(d) + " Uhr";
}

/** Flies the map to a new center/zoom when region changes. */
function FlyToRegion({ regionId }: { regionId: SatelliteRegionId }) {
  const map = useMap();
  useEffect(() => {
    const r = getRegion(regionId);
    map.flyTo(r.center, r.zoom, { duration: 0.8 });
  }, [regionId, map]);
  return null;
}

/**
 * Crossfade-WMS layer: keeps two WMS layers in the DOM and fades opacity
 * between them whenever the active frame changes — eliminates flicker.
 */
function CrossfadeWMS({
  layer,
  time,
}: {
  layer: string;
  time: string;
}) {
  const map = useMap();
  const aRef = useRef<L.TileLayer.WMS | null>(null);
  const bRef = useRef<L.TileLayer.WMS | null>(null);
  const activeRef = useRef<"a" | "b">("a");
  const lastTimeRef = useRef<string>("");
  const lastLayerRef = useRef<string>("");

  useEffect(() => {
    const opts: L.WMSOptions = {
      layers: layer,
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      tileSize: 512,
      opacity: 1,
      attribution: '© <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
    };
    const a = L.tileLayer.wms(WMS_URL, { ...opts, opacity: 1 });
    const b = L.tileLayer.wms(WMS_URL, { ...opts, opacity: 0 });
    a.setParams({ time } as L.WMSParams, false);
    b.setParams({ time } as L.WMSParams, false);
    a.addTo(map);
    b.addTo(map);
    aRef.current = a;
    bRef.current = b;
    lastTimeRef.current = time;
    lastLayerRef.current = layer;
    return () => {
      a.remove();
      b.remove();
      aRef.current = null;
      bRef.current = null;
    };
    // We intentionally only init once on mount + layer change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Layer change → reset both WMS instances.
  useEffect(() => {
    if (!aRef.current || !bRef.current) return;
    if (lastLayerRef.current === layer) return;
    aRef.current.setParams({ layers: layer, time } as L.WMSParams, false);
    bRef.current.setParams({ layers: layer, time } as L.WMSParams, false);
    aRef.current.setOpacity(1);
    bRef.current.setOpacity(0);
    activeRef.current = "a";
    lastLayerRef.current = layer;
    lastTimeRef.current = time;
  }, [layer, time]);

  // Frame (time) change → crossfade.
  useEffect(() => {
    if (!aRef.current || !bRef.current) return;
    if (lastTimeRef.current === time) return;
    const active = activeRef.current;
    const next = active === "a" ? bRef.current : aRef.current;
    const curr = active === "a" ? aRef.current : bRef.current;
    next.setParams({ time } as L.WMSParams, false);
    // Wait one tick for tiles to start loading, then fade.
    const fade = () => {
      next.setOpacity(1);
      curr.setOpacity(0);
    };
    const t = window.setTimeout(fade, 60);
    activeRef.current = active === "a" ? "b" : "a";
    lastTimeRef.current = time;
    return () => window.clearTimeout(t);
  }, [time]);

  return null;
}

export function SatelliteMap({ bare = false }: { bare?: boolean } = {}) {
  const [regionId, setRegionId] = useState<SatelliteRegionId>("schweiz");
  const region = useMemo(() => getRegion(regionId), [regionId]);

  const { data, isLoading } = useQuery({
    queryKey: ["satellite-manifest", regionId],
    queryFn: () => getSatelliteManifest({ data: { region: regionId } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const frames = data?.frames ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedMs, setSpeedMs] = useState(500);
  const [overlays, setOverlays] = useState<Overlays>({
    borders: true,
    cantons: regionId === "schweiz" || regionId === "alpen",
    places: false,
    hillshade: false,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Lock playback to the latest frame when frames arrive / refresh.
  const lastTimeRef = useRef<string | null>(null);
  useEffect(() => {
    if (frames.length === 0) return;
    if (lastTimeRef.current === null) {
      setIndex(frames.length - 1);
      lastTimeRef.current = frames[frames.length - 1].time;
      return;
    }
    // Keep playhead anchored to the same wall-clock time if possible.
    const idx = frames.findIndex((f) => f.time === lastTimeRef.current);
    if (idx >= 0) {
      setIndex(idx);
    } else {
      setIndex(frames.length - 1);
      lastTimeRef.current = frames[frames.length - 1].time;
    }
  }, [frames]);

  // Auto-play loop.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % frames.length;
        lastTimeRef.current = frames[next]?.time ?? null;
        return next;
      });
    }, speedMs);
    return () => window.clearInterval(t);
  }, [playing, speedMs, frames]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowRight") {
        setIndex((i) => {
          const n = Math.min(i + 1, frames.length - 1);
          lastTimeRef.current = frames[n]?.time ?? null;
          return n;
        });
      } else if (e.code === "ArrowLeft") {
        setIndex((i) => {
          const n = Math.max(i - 1, 0);
          lastTimeRef.current = frames[n]?.time ?? null;
          return n;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frames]);

  // Fullscreen API.
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const current = frames[index];
  const layer = data?.layer ?? region.layer;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card shadow-sm",
        bare && "h-full rounded-none border-0 shadow-none",
      )}
    >
      {/* Top bar */}
      <div className="absolute left-3 right-3 top-3 z-[500] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Select value={regionId} onValueChange={(v) => setRegionId(v as SatelliteRegionId)}>
            <SelectTrigger className="h-9 w-[200px] border bg-background/95 backdrop-blur">
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
          {current && (
            <div className="rounded-md border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur sm:text-sm">
              <span className="text-muted-foreground">{region.shortLabel}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span>{formatDateLong(current.time)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="tabular-nums">{formatTimeLong(current.time)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="tabular-nums text-muted-foreground">
                {index + 1}/{frames.length}
              </span>
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-background/95 backdrop-blur">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="space-y-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Overlays
                </div>
                <label className="flex items-center justify-between">
                  <span>Ländergrenzen</span>
                  <Switch
                    checked={overlays.borders}
                    onCheckedChange={(v) => setOverlays((o) => ({ ...o, borders: v }))}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span>Kantonsgrenzen CH</span>
                  <Switch
                    checked={overlays.cantons}
                    onCheckedChange={(v) => setOverlays((o) => ({ ...o, cantons: v }))}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span>Ortsnamen</span>
                  <Switch
                    checked={overlays.places}
                    onCheckedChange={(v) => setOverlays((o) => ({ ...o, places: v }))}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span>Höhenrelief</span>
                  <Switch
                    checked={overlays.hillshade}
                    onCheckedChange={(v) => setOverlays((o) => ({ ...o, hillshade: v }))}
                  />
                </label>
              </div>
            </PopoverContent>
          </Popover>
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
          className="absolute inset-0 z-0 bg-[#0b1220]"
        >
          <FlyToRegion regionId={regionId} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © CARTO'
            subdomains="abcd"
          />
          {overlays.hillshade && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
              attribution="Hillshade © Esri"
              opacity={0.35}
            />
          )}
          {current && <CrossfadeWMS layer={layer} time={current.time} />}
          {overlays.borders && (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              opacity={0.9}
            />
          )}
          <ZoomControl position="bottomright" />
        </MapContainer>

        {isLoading && frames.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && frames.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/80">
            <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Satellitenbilder vorübergehend nicht verfügbar.
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t bg-background/95 px-3 py-3 backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setPlaying(false);
                setIndex((i) => {
                  const n = Math.max(i - 1, 0);
                  lastTimeRef.current = frames[n]?.time ?? null;
                  return n;
                });
              }}
              title="Vorheriger Frame (←)"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9"
              onClick={() => setPlaying((p) => !p)}
              title={playing ? "Pause (Leertaste)" : "Play (Leertaste)"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setPlaying(false);
                setIndex((i) => {
                  const n = Math.min(i + 1, frames.length - 1);
                  lastTimeRef.current = frames[n]?.time ?? null;
                  return n;
                });
              }}
              title="Nächster Frame (→)"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            <Slider
              min={0}
              max={Math.max(frames.length - 1, 0)}
              step={1}
              value={[index]}
              onValueChange={(v) => {
                const n = v[0] ?? 0;
                setPlaying(false);
                setIndex(n);
                lastTimeRef.current = frames[n]?.time ?? null;
              }}
              disabled={frames.length < 2}
            />
            {frames.length > 0 && (
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                <span>{frames[0]?.label} UTC</span>
                <span>{frames[frames.length - 1]?.label} UTC</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed</span>
            <Select
              value={String(speedMs)}
              onValueChange={(v) => setSpeedMs(Number(v))}
            >
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
