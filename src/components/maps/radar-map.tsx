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

import { getRadarFrames, type RadarPayload, type RadarFrame } from "@/lib/radar.functions";
import { cn } from "@/lib/utils";




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


// Niederschlags-Farbskala (mm/h) — MeteoSchweiz-Legende.
const SCALE: { mmh: number; rgb: [number, number, number] }[] = [
  { mmh: 0.2, rgb: [167, 174, 211] },
  { mmh: 1, rgb: [30, 60, 230] },
  { mmh: 2, rgb: [30, 120, 50] },
  { mmh: 4, rgb: [70, 200, 70] },
  { mmh: 6, rgb: [240, 235, 50] },
  { mmh: 10, rgb: [240, 200, 120] },
  { mmh: 20, rgb: [240, 140, 30] },
  { mmh: 40, rgb: [225, 30, 30] },
  { mmh: 60, rgb: [150, 30, 200] },
];

function colorFor(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  if (mmh >= SCALE[SCALE.length - 1].mmh) {
    const [r, g, b] = SCALE[SCALE.length - 1].rgb;
    return [r, g, b, 0.95];
  }
  // Linear interpolation in log(mmh)-Raum für sanftere Farbübergänge.
  for (let i = 0; i < SCALE.length - 1; i++) {
    const a = SCALE[i];
    const b = SCALE[i + 1];
    if (mmh >= a.mmh && mmh < b.mmh) {
      const t = (Math.log(mmh) - Math.log(a.mmh)) / (Math.log(b.mmh) - Math.log(a.mmh));
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      // Markante Deckkraft wie auf der MeteoSchweiz-Messung; schwächste Stufe
      // bewusst tiefer, damit starke Zellen keinen breiten Halo bekommen.
      const alphaA = i === 0 ? 0.45 : 0.92;
      const alphaB = 0.92;
      const al = alphaA + (alphaB - alphaA) * t;
      return [r, g, bl, al];
    }
  }
  return [0, 0, 0, 0];
}

// Schnee-Farbskala (mm/h Wasser-Äquivalent) — MeteoSchweiz: leicht / stark.
const SNOW_SCALE: { mmh: number; rgb: [number, number, number]; label: string }[] = [
  { mmh: 0.1, rgb: [205, 195, 230], label: "leicht" },
  { mmh: 2, rgb: [150, 60, 200], label: "stark" },
];

function snowColorFor(mmh: number): [number, number, number, number] {
  if (mmh < SNOW_SCALE[0].mmh) return [0, 0, 0, 0];
  for (let i = SNOW_SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SNOW_SCALE[i].mmh) {
      const [r, g, b] = SNOW_SCALE[i].rgb;
      const a = 0.85;
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

// Etwas grösser als die erweiterte Daten-Bbox (46.85–48.30 / 8.15–10.55), damit der
// Standardausschnitt knapp drüber liegt.
const maxBoundsExt: L.LatLngBoundsExpression = [
  [46.80, 8.10],
  [48.35, 10.60],
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
  nextFrame,
  progress,
  opacity = 1,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
  nextFrame?: RadarFrame | null;
  progress?: number;
  opacity?: number;
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
        cv.style.zIndex = "440";
        cv.style.filter = "saturate(1.3) contrast(1.15)";
        (cv.style as unknown as { imageRendering: string }).imageRendering = "pixelated";
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
    const nextVals = nextFrame?.values;
    const nextSnowVals = nextFrame?.snowValues;
    const t = nextVals && typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : 0;
    const lerp = (a: number, b: number) => a + (b - a) * t;

    // Volle Container-Auflösung für scharfe Kanten wie auf der Messung.
    const STEP = 1;
    const lowW = Math.max(1, Math.ceil(size.x / STEP));
    const lowH = Math.max(1, Math.ceil(size.y / STEP));
    const img = ctx.createImageData(lowW, lowH);
    const data = img.data;

    for (let ly = 0; ly < lowH; ly++) {
      for (let lx = 0; lx < lowW; lx++) {
        const px = lx * STEP;
        const py = ly * STEP;
        const ll = map.containerPointToLatLng([px, py]);
        const fxRaw = ((ll.lng - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
        const fyRaw = ((ll.lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
        const BUFFER = 3;
        if (fxRaw < -BUFFER || fxRaw > nLon - 1 + BUFFER) continue;
        if (fyRaw < -BUFFER || fyRaw > nLat - 1 + BUFFER) continue;
        // Nearest-Neighbor-Sampling für scharfe Zellen-Kanten wie auf der
        // MeteoSchweiz-Messung (statt bilinearer Verlauf).
        const xi = Math.round(fxRaw);
        const yi = Math.round(fyRaw);
        const inX = xi >= 0 && xi < nLon;
        const inY = yi >= 0 && yi < nLat;
        if (!inX || !inY) continue;
        const sample = (arr: number[]) => arr[yi * nLon + xi] ?? 0;
        const vCur = sample(vals);
        const v = nextVals ? lerp(vCur, sample(nextVals)) : vCur;
        if (v < 0.1) continue;
        let snowFrac = 0;
        if (snowVals) {
          const svCur = sample(snowVals);
          const sv = nextSnowVals ? lerp(svCur, sample(nextSnowVals)) : svCur;
          if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
        }
        const [r, g, b, a] = snowFrac > 0.3 ? snowColorFor(v) : colorFor(v);
        if (a === 0) continue;
        const alpha = Math.round(a * 255);
        if (alpha === 0) continue;
        const idx = (ly * lowW + lx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = alpha;
      }
    }

    // Off-screen Buffer für putImageData (ignoriert Transformationen/Clip).
    const off = document.createElement("canvas");
    off.width = lowW;
    off.height = lowH;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(img, 0, 0);

    // Kein Clip auf imageBbox — Prognose deckt das volle Daten-Grid ab,
    // also auch Bereiche ausserhalb des MeteoSchweiz-Radar-Ausschnitts.
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, lowW, lowH, 0, 0, size.x, size.y);
    ctx.restore();
  };

  // Bei Frame-/Progress-Wechsel neu zeichnen.
  useEffect(() => {
    redrawRef.current();
  }, [frame, nextFrame, progress, payload]);

  // Canvas-Opacity nachziehen (Soft-Blending Nowcast↔ICON-CH1).
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) cv.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }, [opacity]);

  return null;
}

function useNowFrameIndex(frames: RadarFrame[]): number {
  return useMemo(() => {
    if (frames.length === 0) return 0;
    const now = Date.now();
    // 1. Letzter echter Radar-Messframe, dessen Zeit <= jetzt (+60s Toleranz) ist
    let latestRadarIdx = -1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.source !== "radar") continue;
      if (Date.parse(f.t) <= now + 60_000) latestRadarIdx = i;
    }
    if (latestRadarIdx >= 0) return latestRadarIdx;
    // 2. Fallback: letzter Radar-Frame überhaupt
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].source === "radar") return i;
    }
    // 3. Fallback: closest-to-now
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
  if (frame.source === "nowcast") {
    const label =
      frame.motionSource === "wind"
        ? "Nowcast (Wind-Fallback)"
        : "Nowcast Radar-Extrapolation";
    return { label, color: "#d97706" };
  }
  if (frame.source === "icon-ch1") {
    return { label: "MeteoSchweiz ICON-CH1", color: BRAND };
  }
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

function fmtBubble(d: Date, frame: RadarFrame | null): string {
  const now = Date.now();
  const isForecast = frame ? d.getTime() > now + 60000 : false;
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const kind =
    frame?.source === "nowcast"
      ? frame.motionSource === "wind"
        ? "Nowcast (Wind)"
        : "Nowcast"
      : isForecast
        ? "Prognose"
        : "Messung";
  return `${kind}: ${wd}, ${hh}:${mm}`;
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
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(8); } catch { /* ignore */ }
    }
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
  const currentFrame = frames[idx] ?? null;
  const bubbleLabel = fmtBubble(currentDate, currentFrame);

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
          className="relative flex h-7 w-full cursor-pointer touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded sm:h-6"
          style={{ ['--tw-ring-color' as never]: BRAND }}
        >
          {/* Hintergrund-Track */}
          <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-neutral-200">
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
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-neutral-900 ring-2 ring-white"
              style={{ left: `${nowPct}%` }}
            />
          )}

          {/* Handle */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${handlePct}%` }}
          >
            <div className="relative h-6 w-[3px] rounded-sm bg-neutral-900 shadow-md before:absolute before:-inset-x-3 before:-inset-y-2 before:content-['']" />
            {/* Bubble */}
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
  const [speed, setSpeed] = useState(1); // 1× ≈ 800ms pro 15-min-Frame
  const [showHail, setShowHail] = useState(true);

  const [progress, setProgress] = useState(0); // 0…1 zwischen idx und idx+1
  const isMobile = useIsMobile();

  // Auf "jetzt" springen sobald Daten da sind.
  useEffect(() => {
    if (idx === null && frames.length > 0) setIdx(nowIdx);
  }, [nowIdx, frames.length, idx]);

  // Play-Loop mit Cross-Fade: rAF-getrieben, idx steigt erst wenn progress > 1.
  useEffect(() => {
    if (!playing || frames.length === 0) {
      setProgress(0);
      return;
    }
    const FRAME_MS = 800 / speed;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / FRAME_MS;
        if (np >= 1) {
          setIdx((cur) => {
            if (cur === null) return 0;
            const next = cur + 1;
            return next >= frames.length ? 0 : next;
          });
          return np - 1;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, frames.length]);

  const currentFrame = idx !== null ? frames[idx] ?? null : null;
  const nextFrame =
    idx !== null && playing && currentFrame && !currentFrame.precipUrl
      ? frames[(idx + 1) % frames.length] ?? null
      : null;
  // Nur zwischen gleichartigen Canvas-Frames cross-faden (nicht zwischen PNG-Frames).
  const blendNext = nextFrame && !nextFrame.precipUrl ? nextFrame : null;
  const meta = currentFrame ? sourceLabel(currentFrame) : null;

  // Frame "trocken"? Canvas-Frames: max(values) prüfen. PNG-Frames: unbekannt
  // (true=trocken nur bei genau 0 values und keiner URL — wird hier vorsichtig
  // als unbekannt behandelt, damit echte Radar-PNGs nie fälschlich als trocken
  // gemeldet werden).
  const frameMaxMmh = (f: RadarFrame | null): number | null => {
    if (!f) return null;
    if (f.precipUrl) return null; // unbekannt
    if (!f.values || f.values.length === 0) return 0;
    let m = 0;
    for (let i = 0; i < f.values.length; i++) if (f.values[i] > m) m = f.values[i];
    return m;
  };
  const currentMax = frameMaxMmh(currentFrame);
  // Index des nächsten Frames mit sichtbarem Niederschlag (Canvas > 0.1 mm/h
  // ODER PNG, weil dort der Server nur "wet" Schritte ausliefert).
  const nextWetIdx = useMemo(() => {
    if (idx === null) return -1;
    for (let i = idx + 1; i < frames.length; i++) {
      const f = frames[i];
      if (f.precipUrl) return i;
      const m = frameMaxMmh(f);
      if (m !== null && m > 0.1) return i;
    }
    return -1;
  }, [idx, frames]);
  const showDryHint = currentMax !== null && currentMax < 0.05;

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
          zoom={9}
          zoomSnap={0.25}
          maxBounds={maxBoundsExt}
          maxBoundsViscosity={1.0}
          minZoom={8}
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
            style={() => ({ color: "#5ba8c8", weight: 1.2, fillColor: "#7ec8e3", fillOpacity: 0.25 })}
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
            (() => {
              const hasPng = !!currentFrame.precipUrl;
              const hasGrid = Array.isArray(currentFrame.values) && currentFrame.values.length > 0;
              const ib = currentFrame.imageBbox ?? data.imageBbox;
              const opacityVal = Math.max(0, Math.min(1, currentFrame.blendOpacity ?? 1));
              return (
                <>
                  {hasGrid && !hasPng && (
                    <PrecipOverlay
                      payload={data}
                      frame={currentFrame}
                      nextFrame={blendNext}
                      progress={progress}
                      opacity={opacityVal}
                    />
                  )}
                  {hasPng && (
                    <ImageOverlay
                      key={`precip-${currentFrame.t}`}
                      url={currentFrame.precipUrl!}
                      bounds={[
                        [
                          ib.minLat + (currentFrame.imageOffset?.dLat ?? 0),
                          ib.minLon + (currentFrame.imageOffset?.dLon ?? 0),
                        ],
                        [
                          ib.maxLat + (currentFrame.imageOffset?.dLat ?? 0),
                          ib.maxLon + (currentFrame.imageOffset?.dLon ?? 0),
                        ],
                      ]}
                      opacity={opacityVal}
                      zIndex={460}
                      className="mch-precip"
                    />
                  )}
                </>
              );
            })()}
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
          {SNOW_SCALE.map((s) => (
            <div key={`snow-${s.mmh}`} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-4 rounded-sm"
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 sm:h-7 sm:w-7"
                style={{ background: BRAND, borderColor: BRAND, ['--tw-ring-color' as never]: BRAND }}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Play className="h-4 w-4 translate-x-px sm:h-3.5 sm:w-3.5" />}
              </button>
              {/* Prev */}
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIdx((cur) => Math.max(0, (cur ?? 0) - 1));
                }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                aria-label="Vorheriger Frame"
              >
                <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:h-7 sm:w-7"
                aria-label="Nächster Frame"
              >
                <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>

            {/* Sekundär-Toolbar: Jetzt, Speed, Modell, Hagel */}
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

            {showDryHint && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-600">
                <span>
                  Aktuell kein Niederschlag in der Region — Karte zeigt nur Hintergrund.
                </span>
                {nextWetIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIdx(nextWetIdx);
                      setPlaying(false);
                    }}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-100"
                  >
                    Zum nächsten Regen springen →
                  </button>
                )}
              </div>
            )}

            <p className="mt-1.5 text-[10px] text-neutral-500">
              Aktualisiert am {fmtUpdatedAt(data.generatedAt)} · Quellen: MeteoSchweiz Radar (Messung) · MeteoSchweiz ICON-CH1/CH2 (Vorhersage bis +48 h)
            </p>



          </>
        )}
      </div>
    </div>
  );
}
