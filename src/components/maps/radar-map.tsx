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
import { Pause, Play, ChevronLeft, ChevronRight, CloudHail } from "lucide-react";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";

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
  { mmh: 0.1, rgb: [120, 180, 235] },
  { mmh: 0.4, rgb: [80, 160, 230] },
  { mmh: 0.7, rgb: [50, 140, 220] },
  { mmh: 1.3, rgb: [50, 140, 210] },
  { mmh: 2, rgb: [40, 195, 130] },
  { mmh: 3.5, rgb: [40, 195, 40] },
  { mmh: 6, rgb: [220, 220, 50] },
  { mmh: 10, rgb: [240, 175, 30] },
  { mmh: 20, rgb: [240, 115, 30] },
  { mmh: 30, rgb: [235, 50, 50] },
  { mmh: 50, rgb: [200, 25, 85] },
  { mmh: 80, rgb: [170, 15, 125] },
  { mmh: 130, rgb: [140, 15, 175] },
  { mmh: 200, rgb: [120, 75, 215] },
];

function colorFor(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SCALE[i].mmh) {
      const [r, g, b] = SCALE[i].rgb;
      const a = Math.min(1.0, 0.95 + (i / SCALE.length) * 0.05);
      return [r, g, b, a];
    }
  }
  return [0, 0, 0, 0];
}

// Schnee-Farbskala (mm/h Wasser-Äquivalent) — kühles Weiss → Blau.
const SNOW_SCALE: { mmh: number; rgb: [number, number, number] }[] = [
  { mmh: 0.1, rgb: [235, 240, 248] },
  { mmh: 0.4, rgb: [210, 222, 238] },
  { mmh: 0.7, rgb: [180, 200, 228] },
  { mmh: 1.3, rgb: [150, 180, 218] },
  { mmh: 2, rgb: [120, 160, 210] },
  { mmh: 3.5, rgb: [95, 140, 200] },
  { mmh: 6, rgb: [70, 120, 190] },
  { mmh: 10, rgb: [50, 100, 175] },
  { mmh: 20, rgb: [35, 80, 160] },
  { mmh: 30, rgb: [25, 60, 140] },
];

function snowColorFor(mmh: number): [number, number, number, number] {
  if (mmh < SNOW_SCALE[0].mmh) return [0, 0, 0, 0];
  for (let i = SNOW_SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SNOW_SCALE[i].mmh) {
      const [r, g, b] = SNOW_SCALE[i].rgb;
      const a = Math.min(1.0, 0.92 + (i / SNOW_SCALE.length) * 0.08);
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

// Etwas grösser als die Daten-Bbox (47.30–47.85 / 8.85–9.85), damit der
// Standardausschnitt knapp drüber liegt.
const maxBoundsExt: L.LatLngBoundsExpression = [
  [47.25, 8.78],
  [47.90, 9.92],
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
function PrecipOverlay({
  payload,
  frame,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
}) {
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
        cv.style.opacity = "1";
        cv.style.filter = "blur(2px) saturate(1.7) contrast(1.3)";
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
    const snowVals = frame.snowValues;

    // Vollen Viewport zeichnen — Werte ausserhalb des Grids auf Rand klampfen,
    // damit auch die Karten-Ränder eingefärbt werden.
    const minX = 0;
    const maxX = size.x;
    const minY = 0;
    const maxY = size.y;
    if (maxX <= minX || maxY <= minY) return;

    const w = maxX - minX;
    const h = maxY - minY;
    const STEP = 1;
    const img = ctx.createImageData(w * dpr, h * dpr);
    const data = img.data;
    const stride = w * dpr * 4;

    for (let py = 0; py < h; py += STEP) {
      for (let px = 0; px < w; px += STEP) {
        const ll = map.containerPointToLatLng([minX + px, minY + py]);
        const fxRaw = ((ll.lng - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
        const fyRaw = ((ll.lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
        const BUFFER = 3;
        if (fxRaw < -BUFFER || fxRaw > nLon - 1 + BUFFER) continue;
        if (fyRaw < -BUFFER || fyRaw > nLat - 1 + BUFFER) continue;
        // Nearest-Edge-Clamp für Sampling (extrapoliert sanft über den Grid-Rand).
        const fx = Math.max(0, Math.min(nLon - 1, fxRaw));
        const fy = Math.max(0, Math.min(nLat - 1, fyRaw));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(nLon - 1, x0 + 1);
        const y1 = Math.min(nLat - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        const i00 = y0 * nLon + x0;
        const i01 = y0 * nLon + x1;
        const i10 = y1 * nLon + x0;
        const i11 = y1 * nLon + x1;
        const sample = (arr: number[]) =>
          arr[i00] * (1 - tx) * (1 - ty) +
          arr[i01] * tx * (1 - ty) +
          arr[i10] * (1 - tx) * ty +
          arr[i11] * tx * ty;
        const v = sample(vals);
        let snowFrac = 0;
        if (snowVals) {
          const sv = sample(snowVals);
          if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
        }
        const [r, g, b, a] = snowFrac > 0.3 ? snowColorFor(v) : colorFor(v);
        if (a === 0) continue;
        const edgeDist = Math.min(fxRaw, nLon - 1 - fxRaw, fyRaw, nLat - 1 - fyRaw);
        const edgeFade =
          edgeDist >= 0.5
            ? 1
            : edgeDist >= -BUFFER
              ? Math.max(0, (edgeDist + BUFFER) / (BUFFER + 0.5))
              : 0;
        const alpha = Math.round(a * edgeFade * 255);
        if (alpha === 0) continue;
        for (let sy = 0; sy < dpr; sy++) {
          const row = (py * dpr + sy) * stride;
          for (let sx = 0; sx < dpr; sx++) {
            const idx = row + (px * dpr + sx) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = alpha;
          }
        }
      }
    }
    ctx.putImageData(img, minX * dpr, minY * dpr);
  };

  // Bei Frame-/Progress-Wechsel neu zeichnen.
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

// ---------------- MeteoSchweiz-Style Timeline ----------------

const WEEKDAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function fmtUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDayLong(d: Date): string {
  const wd = WEEKDAY_LONG[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}.${mm}.${d.getFullYear()}`;
}

function fmtBubble(d: Date, isForecast: boolean): string {
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${isForecast ? "Prognose" : "Messung"}: ${wd}, ${hh}:${mm}`;
}

function MeteoTimeline({
  frames,
  idx,
  onChange,
  isMobile,
}: {
  frames: RadarFrame[];
  idx: number;
  onChange: (i: number) => void;
  isMobile: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const times = useMemo(() => frames.map((f) => Date.parse(f.t)), [frames]);
  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 1;
  const span = Math.max(1, tMax - tMin);
  const now = Date.now();
  const nowPct = Math.max(0, Math.min(100, ((now - tMin) / span) * 100));

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

  // Stündliche Ticks im sichtbaren Zeitraum.
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

  // Tageswechsel-Linien (00:00).
  const dayBreaks = hourTicks.filter((t) => t.hour === 0);

  // Tages-Labels: Segmente zwischen Day-Breaks.
  const daySegments = useMemo(() => {
    const breaks = [tMin, ...dayBreaks.map((b) => b.ms), tMax];
    const segs: { startPct: number; endPct: number; label: string }[] = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      const a = breaks[i];
      const b = breaks[i + 1];
      if (b <= a) continue;
      // Label = Datum des Mittelpunkts.
      const mid = new Date((a + b) / 2);
      segs.push({
        startPct: pctForMs(a),
        endPct: pctForMs(b),
        label: fmtDayLong(mid),
      });
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax, dayBreaks.length]);

  const handlePct = pctForIdx(idx);
  const currentMs = times[idx] ?? now;
  const currentDate = new Date(currentMs);
  const isForecast = currentMs > now + 60000;
  const bubbleLabel = fmtBubble(currentDate, isForecast);

  // Auf Mobile nur jede 3. Stunde labeln, damit's nicht überlappt.
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

        {/* Track-Hit-Area */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Radar-Zeit"
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
          className="relative flex h-4 w-full cursor-pointer touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded"
          style={{ ['--tw-ring-color' as never]: BRAND }}
        >
          {/* Hintergrund-Track */}
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-neutral-200">
            {/* Vorhersage-Range */}
            <div
              className="absolute inset-y-0"
              style={{
                left: `${nowPct}%`,
                width: `${Math.max(0, 100 - nowPct)}%`,
                background: BRAND,
                opacity: 0.9,
              }}
            />
            {/* Hour-Ticks im Track */}
            {hourTicks.map((t) => (
              <span
                key={`ht-${t.ms}`}
                className="absolute top-0 h-full w-px bg-neutral-300"
                style={{ left: `${t.pct}%` }}
              />
            ))}
          </div>

          {/* Day-Break-Vertikallinien */}
          {dayBreaks.map((b) => (
            <span
              key={`db-${b.ms}`}
              className="pointer-events-none absolute inset-y-0 w-px bg-neutral-300"
              style={{ left: `${b.pct}%` }}
            />
          ))}

          {/* "Jetzt"-Marker */}
          {nowPct > 0 && nowPct < 100 && (
            <span
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-neutral-900 ring-2 ring-white"
              style={{ left: `${nowPct}%` }}
            />
          )}

          {/* Handle */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${handlePct}%` }}
          >
            <div className="h-4 w-0.5 rounded-sm bg-neutral-900" />
            {/* Bubble */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span
                className="whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
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

        {/* Tages-Labels unter dem Track */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
          {daySegments.map((s, i) => {
            const width = Math.max(0, s.endPct - s.startPct);
            if (width < (isMobile ? 18 : 10)) return null;
            return (
              <span
                key={`ds-${i}`}
                className="absolute top-0 text-[10px] font-medium text-neutral-600 truncate"
                style={{
                  left: `${s.startPct}%`,
                  width: `${width}%`,
                  textAlign: "center",
                }}
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
  const [speed, setSpeed] = useState(1); // 1× ≈ 800ms pro Frame
  const [showHail, setShowHail] = useState(true);
  const isMobile = useIsMobile();

  // Auf "jetzt" springen sobald Daten da sind.
  useEffect(() => {
    if (idx === null && frames.length > 0) setIdx(nowIdx);
  }, [nowIdx, frames.length, idx]);

  // Play-Loop: setInterval, harter Frame-Wechsel.
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(() => {
      setIdx((cur) => {
        if (cur === null) return 0;
        const next = cur + 1;
        return next >= frames.length ? 0 : next;
      });
    }, 800 / speed);
    return () => clearInterval(id);
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
          center={[47.575, 9.35]}
          zoom={9.75}
          zoomSnap={0.25}
          maxBounds={maxBoundsExt}
          maxBoundsViscosity={1.0}
          minZoom={8.5}
          maxZoom={15}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#ebefeb" }}
        >
          <InvalidateOnResize />
          <LakePane />
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.55}
            attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz'
          />
          <GeoJSON
            data={OUTSIDE_CH_MASK}
            style={() => ({ stroke: false, fillColor: "#3a4148", fillOpacity: 0.4 })}
            interactive={false}
          />
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.18 })}
            interactive={false}
          />
          <GeoJSON
            data={LAKE}
            pane="lake"
            style={() => ({ color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 0.92 })}
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
                opacity={0.95}
                className="mch-precip"
              />
            ) : (
              <PrecipOverlay
                payload={data}
                frame={currentFrame}
                nextFrame={blendNext}
                progress={progress}
              />
            ))}
          {data && currentFrame && showHail && currentFrame.hailUrl && (
            <ImageOverlay
              key={`hail-${currentFrame.t}`}
              url={currentFrame.hailUrl}
              bounds={[
                [data.imageBbox.minLat, data.imageBbox.minLon],
                [data.imageBbox.maxLat, data.imageBbox.maxLon],
              ]}
              opacity={0.95}
              className="hail-blackdots"
            />
          )}

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
          <span className="mt-1.5 mb-0.5 font-semibold text-foreground">Schnee</span>
          <div className="flex items-center gap-1">
            {SNOW_SCALE.filter((_, i) => i % 2 === 0).map((s) => (
              <span
                key={`snow-${s.mmh}`}
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Steuerung — schlankes weisses Panel */}
      <div className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-900 shadow-md sm:p-3">
        {isLoading && (
          <p className="text-center text-xs text-neutral-500">Lade Radardaten …</p>
        )}
        {error && (
          <p className="text-center text-xs text-red-600">
            Radardaten konnten nicht geladen werden.
          </p>
        )}
        {data?.warning && (
          <p className="mb-1.5 text-center text-[11px] text-neutral-500">
            Hinweis: {data.warning}
          </p>
        )}

        {data && frames.length > 0 && idx !== null && (
          <>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Play/Pause */}
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2"
                style={{ ['--tw-ring-color' as never]: BRAND }}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
              </button>
              {/* Prev */}
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIdx((cur) => Math.max(0, (cur ?? 0) - 1));
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                aria-label="Vorheriger Frame"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {/* Track */}
              <div className="min-w-0 flex-1">
                <MeteoTimeline
                  frames={frames}
                  idx={idx}
                  isMobile={isMobile}
                  onChange={(i) => {
                    setIdx(i);
                    setPlaying(false);
                  }}
                />
              </div>

              {/* Next */}
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIdx((cur) => Math.min(frames.length - 1, (cur ?? 0) + 1));
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                aria-label="Nächster Frame"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Sekundär-Toolbar: Jetzt, Speed, Hagel */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setIdx(nowIdx);
                  setPlaying(false);
                }}
                className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Jetzt
              </button>

              <div className="inline-flex items-center rounded-full border border-neutral-200 bg-white p-0.5">
                {[1, 2, 4].map((s) => {
                  const active = speed === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold transition",
                        active ? "text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900",
                      )}
                      style={active ? { background: BRAND } : undefined}
                    >
                      {s}×
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowHail((v) => !v)}
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition",
                  !data?.hasHail && "cursor-not-allowed opacity-60",
                  showHail && data?.hasHail
                    ? "border-transparent text-white shadow-sm"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                )}
                style={showHail && data?.hasHail ? { background: BRAND } : undefined}
                title={
                  data?.hasHail
                    ? "Hagelwahrscheinlichkeit (POH) ein-/ausblenden"
                    : "Hagel – nur in der Vergangenheit verfügbar, sobald MeteoSchweiz-Radar aktiv ist"
                }
                disabled={!data?.hasHail}
              >
                <CloudHail className="h-3 w-3" />
                Hagel
                {!data?.hasHail && <span className="text-[9px] opacity-70">bald</span>}
              </button>
            </div>

            <p className="mt-1.5 text-[10px] text-neutral-500">
              Aktualisiert am {fmtUpdatedAt(data.generatedAt)} · Quellen: MeteoSchweiz Radar (Messung) · MeteoSchweiz ICON-CH1 (Vorhersage bis +32 h)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
