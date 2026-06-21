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
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SATELLITE_REGIONS,
  getRegion,
  getSatelliteManifest,
  type SatelliteRegionId,
  type SatelliteFrame,
} from "@/lib/satellite.functions";

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";

const SPEEDS = [
  { label: "0.5×", ms: 1000 },
  { label: "1×", ms: 500 },
  { label: "2×", ms: 250 },
  { label: "4×", ms: 125 },
];

function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date(iso));
}

function formatTimeLong(iso: string): string {
  return (
    new Intl.DateTimeFormat("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    }).format(new Date(iso)) + " Uhr"
  );
}

function FlyToRegion({ regionId }: { regionId: SatelliteRegionId }) {
  const map = useMap();
  useEffect(() => {
    const r = getRegion(regionId);
    map.flyTo(r.center, r.zoom, { duration: 0.8 });
  }, [regionId, map]);
  return null;
}

/**
 * Mountet einen WMS-Layer pro Frame (alle opacity:0 außer activeIndex).
 * Frame-Wechsel = nur Opacity-Toggle → keine neuen Requests, kein Flackern.
 * Meldet Loading-Fortschritt via onProgress (0..1).
 */
function FrameStack({
  layer,
  frames,
  activeIndex,
  onProgress,
}: {
  layer: string;
  frames: SatelliteFrame[];
  activeIndex: number;
  onProgress: (loaded: number, total: number) => void;
}) {
  const map = useMap();
  const layersRef = useRef<L.TileLayer.WMS[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    loadedRef.current = new Set();
    const opts: L.WMSOptions = {
      layers: layer,
      format: "image/jpeg",
      transparent: false,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      tileSize: 256,
      attribution:
        '© <a href="https://www.eumetsat.int/" target="_blank" rel="noopener">EUMETSAT</a>',
    };
    const arr: L.TileLayer.WMS[] = frames.map((f, i) => {
      const tl = L.tileLayer.wms(WMS_URL, { ...opts, opacity: 0 });
      tl.setParams({ time: f.time } as unknown as L.WMSParams, false);
      tl.on("load", () => {
        if (!loadedRef.current.has(i)) {
          loadedRef.current.add(i);
          onProgress(loadedRef.current.size, frames.length);
        }
      });
      tl.addTo(map);
      return tl;
    });
    layersRef.current = arr;
    // initial: aktivieren
    if (arr[activeIndex]) arr[activeIndex].setOpacity(1);
    onProgress(0, frames.length);
    return () => {
      arr.forEach((tl) => tl.remove());
      layersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, layer, frames]);

  // Active-Index ändern → Opacity umschalten
  useEffect(() => {
    const arr = layersRef.current;
    arr.forEach((tl, i) => tl.setOpacity(i === activeIndex ? 1 : 0));
  }, [activeIndex]);

  return null;
}

export function SatelliteMap({ bare = false }: { bare?: boolean } = {}) {
  const [regionId, setRegionId] = useState<SatelliteRegionId>("alpen-ch");
  const region = useMemo(() => getRegion(regionId), [regionId]);

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

  // Reset auf neuesten Frame bei Frame-Wechsel
  const lastTimeRef = useRef<string | null>(null);
  useEffect(() => {
    if (frames.length === 0) return;
    if (lastTimeRef.current === null) {
      setIndex(frames.length - 1);
      lastTimeRef.current = frames[frames.length - 1].time;
      return;
    }
    const idx = frames.findIndex((f) => f.time === lastTimeRef.current);
    if (idx >= 0) setIndex(idx);
    else {
      setIndex(frames.length - 1);
      lastTimeRef.current = frames[frames.length - 1].time;
    }
  }, [frames]);

  // Loading-Reset bei Region-/Frame-Wechsel
  useEffect(() => {
    setLoaded(0);
    setPlaying(false);
  }, [regionId]);

  // Auto-start sobald geladen
  useEffect(() => {
    if (ready && !playing && total >= 2) setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Playback
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

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowRight") {
        setIndex((i) => {
          const n = Math.min(i + 1, total - 1);
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
  }, [total, frames]);

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

  const current = frames[index];
  const layer = data?.layer ?? region.layer;
  const source = data?.source ?? region.source;

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
          {current && (
            <div className="rounded-md border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur sm:text-sm">
              <span>{formatDateLong(current.time)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="tabular-nums">{formatTimeLong(current.time)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="tabular-nums text-muted-foreground">
                {index + 1}/{total}
              </span>
              {!ready && total > 0 && (
                <>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    Lade {loaded}/{total} …
                  </span>
                </>
              )}
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
              frames={frames}
              activeIndex={index}
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

        {/* Quellen-Badge unten links */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-black/55 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {source}
        </div>
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
              onClick={() => {
                setPlaying(false);
                setIndex((i) => {
                  const n = Math.min(i + 1, total - 1);
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
              max={Math.max(total - 1, 0)}
              step={1}
              value={[index]}
              onValueChange={(v) => {
                const n = v[0] ?? 0;
                setPlaying(false);
                setIndex(n);
                lastTimeRef.current = frames[n]?.time ?? null;
              }}
              disabled={total < 2}
            />
            {total > 0 && (
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                <span>{frames[0]?.label} UTC</span>
                <span>{frames[total - 1]?.label} UTC</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed</span>
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
