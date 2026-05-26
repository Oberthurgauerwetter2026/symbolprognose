import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  GeoJSON,
  Marker,
  TileLayer,
  ZoomControl,
  ImageOverlay,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { Pause, Play, SkipForward, CloudHail } from "lucide-react";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRadarFrames, type RadarPayload, type RadarFrame } from "@/lib/radar.functions";

const BRAND = "#2561a1";
const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;

const RADAR_CITIES: { name: string; lat: number; lon: number }[] = [
  { name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { name: "Erlen", lat: 47.5375, lon: 9.2378 },
  { name: "Bischofszell", lat: 47.4944, lon: 9.2389 },
  { name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { name: "Güttingen", lat: 47.6011, lon: 9.2917 },
  { name: "Egnach", lat: 47.5444, lon: 9.3833 },
  { name: "Horn", lat: 47.4986, lon: 9.4470 },
];

function cityIcon(name: string): L.DivIcon {
  const bullet =
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2561a1;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;line-height:1;margin-right:4px;vertical-align:middle;";
  const label =
    "font:500 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;vertical-align:middle;";
  return L.divIcon({
    className: "radar-city-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}


// Niederschlags-Farbskala (mm/h) — MeteoSchweiz CPC.
const SCALE: { mmh: number; rgb: [number, number, number] }[] = [
  { mmh: 0.1, rgb: [200, 220, 245] },
  { mmh: 0.4, rgb: [160, 200, 240] },
  { mmh: 0.7, rgb: [120, 180, 235] },
  { mmh: 1.3, rgb: [80, 160, 220] },
  { mmh: 2, rgb: [60, 200, 140] },
  { mmh: 3.5, rgb: [60, 200, 60] },
  { mmh: 6, rgb: [220, 220, 60] },
  { mmh: 10, rgb: [240, 180, 40] },
  { mmh: 20, rgb: [240, 120, 40] },
  { mmh: 30, rgb: [235, 60, 60] },
  { mmh: 50, rgb: [200, 30, 90] },
  { mmh: 80, rgb: [170, 20, 130] },
  { mmh: 130, rgb: [140, 20, 180] },
  { mmh: 200, rgb: [120, 80, 220] },
];

function colorFor(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SCALE[i].mmh) {
      const [r, g, b] = SCALE[i].rgb;
      const a = Math.min(0.9, 0.55 + (i / SCALE.length) * 0.35);
      return [r, g, b, a];
    }
  }
  return [0, 0, 0, 0];
}

const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon") for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  };
  collect(REGION);
  collect(LAKE);
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const OUTSIDE_CH_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon") for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  };
  collect(SWITZERLAND);
  collect(LAKE);
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const feat: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
  return { type: "FeatureCollection", features: [feat] };
})();

const regionBounds: L.LatLngBoundsExpression = [
  [47.4744785, 9.1771913],
  [47.6392538, 9.4773698],
];

// Etwas weiter als die strenge Region-Bbox, damit der leicht herausgezoomte
// Standardausschnitt nicht direkt am Rand kollidiert.
const maxBoundsExt: L.LatLngBoundsExpression = [
  [47.32, 8.95],
  [47.79, 9.70],
];

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const fit = () => map.invalidateSize();
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

/**
 * Canvas-Overlay-Layer, der ein Niederschlags-Grid mit bilinearer Interpolation
 * über die Karte rendert. Updates per setFrame() ohne Layer-Neuaufbau.
 */
function PrecipOverlay({ payload, frame }: { payload: RadarPayload; frame: RadarFrame | null }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  // Canvas-Layer einmalig anlegen.
  useEffect(() => {
    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "radar-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.willChange = "transform";
        cv.style.opacity = "0.7";
        pane.appendChild(cv);
        this._canvas = cv;
        canvasRef.current = cv;
        map.on("moveend zoomend resize", redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _canvas?: HTMLCanvasElement }) {
        if (this._canvas) this._canvas.remove();
        map.off("moveend zoomend resize", redraw);
        canvasRef.current = null;
        return this;
      },
    });

    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const redrawRef = useRef<() => void>(() => {});
  function redraw() {
    redrawRef.current();
  }

  redrawRef.current = () => {
    const cv = canvasRef.current;
    if (!cv || !frame) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = size.x + "px";
    cv.style.height = size.y + "px";
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(cv, topLeft);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const { gridLat, gridLon } = payload;
    const nLat = gridLat.length;
    const nLon = gridLon.length;
    const vals = frame.values;

    // Pixel-Bounds des Grids berechnen (Eckpunkte projizieren).
    const corners = [
      map.latLngToContainerPoint([gridLat[0], gridLon[0]]),
      map.latLngToContainerPoint([gridLat[0], gridLon[nLon - 1]]),
      map.latLngToContainerPoint([gridLat[nLat - 1], gridLon[0]]),
      map.latLngToContainerPoint([gridLat[nLat - 1], gridLon[nLon - 1]]),
    ];
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))));
    const maxX = Math.min(size.x, Math.ceil(Math.max(...corners.map((c) => c.x))));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))));
    const maxY = Math.min(size.y, Math.ceil(Math.max(...corners.map((c) => c.y))));
    if (maxX <= minX || maxY <= minY) return;

    const w = maxX - minX;
    const h = maxY - minY;
    // Step in CSS-Pixeln; gröberes Raster = schneller, immer noch glatt durch bilinear.
    const STEP = 3;
    const img = ctx.createImageData(w * dpr, h * dpr);
    const data = img.data;

    for (let py = 0; py < h; py += STEP) {
      for (let px = 0; px < w; px += STEP) {
        const ll = map.containerPointToLatLng([minX + px, minY + py]);
        // Grid-Indizes (fractional).
        const fx = ((ll.lng - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
        const fy = ((ll.lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
        if (fx < 0 || fy < 0 || fx > nLon - 1 || fy > nLat - 1) continue;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(nLon - 1, x0 + 1);
        const y1 = Math.min(nLat - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        const v =
          vals[y0 * nLon + x0] * (1 - tx) * (1 - ty) +
          vals[y0 * nLon + x1] * tx * (1 - ty) +
          vals[y1 * nLon + x0] * (1 - tx) * ty +
          vals[y1 * nLon + x1] * tx * ty;
        const [r, g, b, a] = colorFor(v);
        if (a === 0) continue;
        // Block STEP×STEP CSS-Pixel füllen (mit DPR).
        for (let dy = 0; dy < STEP; dy++) {
          const yy = (py + dy) * dpr;
          if (yy >= h * dpr) break;
          for (let dx = 0; dx < STEP; dx++) {
            const xx = (px + dx) * dpr;
            if (xx >= w * dpr) break;
            for (let sy = 0; sy < dpr; sy++) {
              for (let sx = 0; sx < dpr; sx++) {
                const idx = ((Math.floor(yy) + sy) * w * dpr + Math.floor(xx) + sx) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = Math.round(a * 255);
              }
            }
          }
        }
      }
    }
    ctx.putImageData(img, minX * dpr, minY * dpr);
  };

  // Bei Frame-Wechsel neu zeichnen.
  useEffect(() => {
    redrawRef.current();
  }, [frame, payload]);

  return null;
}

function useNowFrameIndex(frames: RadarFrame[]): number {
  return useMemo(() => {
    if (frames.length === 0) return 0;
    const now = Date.now();
    let bestIdx = 0;
    let bestDt = Infinity;
    for (let i = 0; i < frames.length; i++) {
      const dt = Math.abs(Date.parse(frames[i].t) - now);
      if (dt < bestDt) {
        bestDt = dt;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [frames]);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function sourceLabel(frame: RadarFrame): { label: string; color: string } {
  if (frame.source === "radar") {
    return { label: "Messung MeteoSchweiz", color: "#1f7a3a" };
  }
  if (frame.source === "icon-ch1") return { label: "MeteoSchweiz ICON-CH1", color: BRAND };
  return { label: "MeteoSchweiz ICON-CH2", color: "#7a4ca0" };
}

// ---------------- Modern Timeline Slider ----------------

const TIMELINE_TICKS_DESKTOP = [-2, -1, 0, 3, 6, 12, 24, 32];
const TIMELINE_TICKS_MOBILE = [-1, 0, 6, 16, 32];

function tickLabel(h: number): string {
  if (h === 0) return "Jetzt";
  if (h < 0) return `${h}h`;
  return `+${h}h`;
}

function Timeline({
  frames,
  idx,
  onChange,
}: {
  frames: RadarFrame[];
  idx: number;
  onChange: (i: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const isMobile = useIsMobile();

  const times = useMemo(() => frames.map((f) => Date.parse(f.t)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const span = Math.max(1, tMax - tMin);
  const now = Date.now();
  const nowPct = Math.max(0, Math.min(100, ((now - tMin) / span) * 100));

  const pctForIdx = (i: number): number => {
    const t = times[i] ?? tMin;
    return Math.max(0, Math.min(100, ((t - tMin) / span) * 100));
  };

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

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(idxFromClientX(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onChange(idxFromClientX(e.clientX));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePct = pctForIdx(idx);
  const currentMs = times[idx] ?? now;
  const handleLabel = new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(currentMs));

  const tickHours = isMobile ? TIMELINE_TICKS_MOBILE : TIMELINE_TICKS_DESKTOP;
  const visibleTicks = tickHours
    .map((h) => {
      const tMs = now + h * 3600 * 1000;
      const pct = ((tMs - tMin) / span) * 100;
      return { h, pct };
    })
    .filter((t) => t.pct >= 0 && t.pct <= 100);

  const showBubble = dragging || focused;

  return (
    <div className="select-none">
      {/* Tick-Labels */}
      <div className="relative mb-1.5 h-3.5 text-[11px] text-muted-foreground">
        {visibleTicks.map((t) => (
          <span
            key={t.h}
            className={cn(
              "absolute -translate-x-1/2 tabular-nums",
              t.h === 0 && "font-semibold text-foreground",
            )}
            style={{ left: `${t.pct}%` }}
          >
            {tickLabel(t.h)}
          </span>
        ))}
      </div>

      {/* Track-Wrapper (grosses Touch-Target) */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Radar-Zeit"
        aria-valuemin={0}
        aria-valuemax={frames.length - 1}
        aria-valuenow={idx}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
        className="relative flex h-11 w-full cursor-pointer touch-none items-center outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
      >
        {/* Dünne Track-Linie */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {/* Vergangenheit */}
          <div
            className="absolute inset-y-0 left-0 bg-muted-foreground/25"
            style={{ width: `${nowPct}%` }}
          />
          {/* ICON-CH1 (Vorhersage) */}
          <div
            className="absolute inset-y-0"
            style={{
              left: `${nowPct}%`,
              width: `${Math.max(0, 100 - nowPct)}%`,
              background: "hsl(212 60% 55% / 0.45)",
            }}
          />
        </div>

        {/* "Jetzt"-Linie */}
        {nowPct > 0 && nowPct < 100 && (
          <div
            className="pointer-events-none absolute inset-y-1.5 w-px bg-foreground/60"
            style={{ left: `${nowPct}%` }}
          />
        )}

        {/* Drag-Handle */}
        <div
          className="pointer-events-none absolute top-1/2 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background shadow-sm transition-transform sm:h-[18px] sm:w-[18px]"
          style={{ left: `${handlePct}%`, borderColor: BRAND }}
        >
          {showBubble && (
            <span
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-foreground after:content-['']"
            >
              {handleLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}






export function RadarMap({ bare = false }: { bare?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["radar-frames"],
    queryFn: () => getRadarFrames(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const frames = data?.frames ?? [];
  const nowIdx = useNowFrameIndex(frames);
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1× = 400ms/frame
  const [showHail, setShowHail] = useState(true);

  // Auf "jetzt" springen sobald Daten da sind.
  useEffect(() => {
    if (idx === null && frames.length > 0) setIdx(nowIdx);
  }, [nowIdx, frames.length, idx]);

  // Play-Loop.
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const ms = 400 / speed;
    const id = window.setInterval(() => {
      setIdx((cur) => {
        if (cur === null) return 0;
        const next = cur + 1;
        if (next >= frames.length) return 0;
        return next;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [playing, speed, frames.length]);

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  const meta = currentFrame ? sourceLabel(currentFrame) : null;

  return (
    <div className={cn("@container", bare ? "flex h-full w-full flex-col" : "space-y-3")}>
      <div
        className={cn(
          "relative overflow-hidden shadow-lg",
          bare
            ? "h-full w-full min-h-0 flex-1"
            : "-mx-3 h-[560px] w-auto sm:mx-0 sm:h-[600px] sm:w-full sm:rounded-2xl",
        )}
      >
        <MapContainer
          center={[47.555, 9.33]}
          zoom={10.5}
          zoomSnap={0.25}
          maxBounds={maxBoundsExt}
          maxBoundsViscosity={1.0}
          minZoom={9}
          maxZoom={15}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#ebefeb" }}
        >
          <InvalidateOnResize />
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.55}
            attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz'
          />
          {data &&
            currentFrame &&
            (currentFrame.precipUrl ? (
              <ImageOverlay
                key={`precip-${currentFrame.t}`}
                url={currentFrame.precipUrl}
                bounds={[
                  [data.imageBbox.minLat, data.imageBbox.minLon],
                  [data.imageBbox.maxLat, data.imageBbox.maxLon],
                ]}
                opacity={0.75}
              />
            ) : (
              <PrecipOverlay payload={data} frame={currentFrame} />
            ))}
          {data && currentFrame && showHail && currentFrame.hailUrl && (
            <ImageOverlay
              key={`hail-${currentFrame.t}`}
              url={currentFrame.hailUrl}
              bounds={[
                [data.imageBbox.minLat, data.imageBbox.minLon],
                [data.imageBbox.maxLat, data.imageBbox.maxLon],
              ]}
              opacity={0.7}
            />
          )}

          <GeoJSON
            data={OUTSIDE_CH_MASK}
            style={() => ({ stroke: false, fillColor: "#3a4148", fillOpacity: 0.4 })}
            interactive={false}
          />
          <GeoJSON
            data={SWITZERLAND}
            style={() => ({ color: "#ffffff", weight: 1.2, opacity: 0.95, fill: false })}
            interactive={false}
          />
          <GeoJSON
            data={THURGAU}
            style={() => ({ color: "#1f4d80", weight: 1, opacity: 0.45, fill: false })}
            interactive={false}
          />
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.18 })}
            interactive={false}
          />
          <GeoJSON
            data={LAKE}
            style={() => ({ color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 1 })}
            interactive={false}
          />
          {RADAR_CITIES.map((c) => (
            <Marker
              key={c.name}
              position={[c.lat, c.lon]}
              icon={cityIcon(c.name)}
              interactive={false}
              keyboard={false}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>

        {/* Quellen-Badge oben links */}
        {meta && (
          <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-1">
            <span
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-md"
              style={{ background: meta.color }}
            >
              {meta.label}
            </span>
            {currentFrame && (
              <span className="rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-md">
                {fmtTime(currentFrame.t)}
              </span>
            )}
          </div>
        )}

        {/* Legende oben rechts (unter Zoom) */}
        <div className="pointer-events-none absolute right-3 top-24 z-[400] hidden flex-col gap-0.5 rounded-md bg-card/95 p-2 text-[10px] shadow-md sm:flex">
          <span className="mb-1 font-semibold text-foreground">mm/h</span>
          {[...SCALE].reverse().map((s) => (
            <div key={s.mmh} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-4 rounded-sm"
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
              <span className="tabular-nums text-muted-foreground">{s.mmh}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steuerung */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Lade Radardaten …</p>
        )}
        {error && (
          <p className="text-center text-sm text-destructive">
            Radardaten konnten nicht geladen werden.
          </p>
        )}
        {data?.warning && (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Hinweis: {data.warning}
          </p>
        )}

        {data && frames.length > 0 && idx !== null && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={playing ? "secondary" : "default"}
                onClick={() => setPlaying((p) => !p)}
                className="gap-1.5"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIdx(nowIdx);
                  setPlaying(false);
                }}
                className="gap-1.5"
              >
                <SkipForward className="h-4 w-4" />
                Jetzt
              </Button>
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5 text-xs">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "rounded px-2 py-1 font-semibold",
                      speed === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1 text-xs">

                <button
                  type="button"
                  onClick={() => setShowHail((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium transition",
                    !data?.hasHail && "cursor-not-allowed opacity-60",
                    showHail && data?.hasHail
                      ? "border-purple-300 bg-purple-100 text-purple-900"
                      : "bg-muted text-muted-foreground",
                  )}
                  title={
                    data?.hasHail
                      ? "Hagelwahrscheinlichkeit (POH) ein-/ausblenden"
                      : "Hagel – nur in der Vergangenheit verfügbar, sobald MeteoSchweiz-Radar aktiv ist"
                  }
                  disabled={!data?.hasHail}
                >
                  <CloudHail className="h-3.5 w-3.5" />
                  Hagel
                  {!data?.hasHail && <span className="text-[9px] opacity-70">bald</span>}
                </button>
              </div>
            </div>

            <div className="px-1 pt-4">
              <Timeline
                frames={frames}
                idx={idx}
                onChange={(i) => {
                  setIdx(i);
                  setPlaying(false);
                }}
              />
            </div>

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Quellen: MeteoSchweiz Radar (Messung) · MeteoSchweiz ICON-CH1 (Vorhersage bis +32 h)
              {" · Datenstand: "}
              {new Intl.DateTimeFormat("de-CH", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(data.generatedAt))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
