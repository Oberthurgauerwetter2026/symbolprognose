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


// Niederschlags-Farbskala (mm/h) — MeteoSchweiz-CombiPrecip-Reset.
// MUSS exakt zu PRECIP_SCALE in scripts/ingest_radar.py passen
// (gleiche Schwellen + RGBA), damit Messung-PNG und Forecast-Canvas
// identisch aussehen. Alpha hier 0..1; die finale Deckkraft setzt die
// einheitliche ImageOverlay-/Canvas-`opacity` im Frontend.
const SCALE: { mmh: number; rgb: [number, number, number]; a: number }[] = [
  { mmh: 0.1,   rgb: [150, 195, 235], a: 235 / 255 },
  { mmh: 0.3,   rgb: [ 95, 155, 220], a: 255 / 255 },
  { mmh: 0.8,   rgb: [ 40,  90, 195], a: 255 / 255 },
  { mmh: 2,     rgb: [ 55, 170,  75], a: 255 / 255 },
  { mmh: 5,     rgb: [245, 220,  55], a: 255 / 255 },
  { mmh: 15,    rgb: [240, 140,  35], a: 255 / 255 },
  { mmh: 40,    rgb: [220,  40,  40], a: 255 / 255 },
  { mmh: 80,    rgb: [170,  40, 180], a: 255 / 255 },
];

function colorFor(mmh: number): [number, number, number, number] {
  // Quantisierte harte Bänder — gibt scharfe Iso-Konturen wie auf MCH-CombiPrecip.
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  let band = SCALE[0];
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SCALE[i].mmh) {
      band = SCALE[i];
      break;
    }
  }
  return [band.rgb[0], band.rgb[1], band.rgb[2], band.a];
}

// Weiche Farbskala für Prognose-Frames — linear zwischen zwei Bändern blenden,
// damit die ICON-CH1-Felder nicht als rechteckige Blöcke wirken.
function colorForSmooth(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  if (mmh >= SCALE[SCALE.length - 1].mmh) {
    const last = SCALE[SCALE.length - 1];
    return [last.rgb[0], last.rgb[1], last.rgb[2], last.a];
  }
  for (let i = 0; i < SCALE.length - 1; i++) {
    const lo = SCALE[i];
    const hi = SCALE[i + 1];
    if (mmh >= lo.mmh && mmh < hi.mmh) {
      // log-Interpolation, weil die Skala selbst log-artig ist (0.1→0.3→0.8→2…).
      const tt =
        (Math.log(mmh) - Math.log(lo.mmh)) /
        (Math.log(hi.mmh) - Math.log(lo.mmh));
      const t = Math.max(0, Math.min(1, tt));
      return [
        Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t),
        Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t),
        Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t),
        lo.a + (hi.a - lo.a) * t,
      ];
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

const REGION_OUTLINE: FeatureCollection = (() => {
  const rings: number[][][] = [];
  for (const f of REGION.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") for (const r of g.coordinates) rings.push(r);
    else if (g.type === "MultiPolygon")
      for (const p of g.coordinates) for (const r of p) rings.push(r);
  }
  const key = (p: number[]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const segKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const count = new Map<string, number>();
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const k = segKey(key(r[i]), key(r[i + 1]));
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  // outer edges = count === 1; build adjacency on point keys
  const adj = new Map<string, Map<string, number[]>>();
  const pt = new Map<string, number[]>();
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      const ka = key(a);
      const kb = key(b);
      if (count.get(segKey(ka, kb)) !== 1) continue;
      pt.set(ka, a);
      pt.set(kb, b);
      if (!adj.has(ka)) adj.set(ka, new Map());
      if (!adj.has(kb)) adj.set(kb, new Map());
      adj.get(ka)!.set(kb, b);
      adj.get(kb)!.set(ka, a);
    }
  }
  const lines: number[][][] = [];
  const visited = new Set<string>();
  const edgeKey = (a: string, b: string) => segKey(a, b);
  for (const start of adj.keys()) {
    for (const [next] of adj.get(start)!) {
      const ek = edgeKey(start, next);
      if (visited.has(ek)) continue;
      const line: number[][] = [pt.get(start)!];
      let prev = start;
      let cur = next;
      visited.add(ek);
      line.push(pt.get(cur)!);
      while (true) {
        const neighbors = adj.get(cur);
        if (!neighbors) break;
        let nx: string | null = null;
        for (const [n] of neighbors) {
          if (n === prev) continue;
          if (visited.has(edgeKey(cur, n))) continue;
          nx = n;
          break;
        }
        if (!nx) break;
        visited.add(edgeKey(cur, nx));
        line.push(pt.get(nx)!);
        prev = cur;
        cur = nx;
        if (cur === start) break;
      }
      lines.push(line);
    }
  }
  const feat: Feature = {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: lines },
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

function useMapZoom(): number {
  const map = useMap();
  const [z, setZ] = useState<number>(() => map.getZoom());
  useEffect(() => {
    const update = () => setZ(map.getZoom());
    map.on("zoomend zoom", update);
    update();
    return () => {
      map.off("zoomend zoom", update);
    };
  }, [map]);
  return z;
}

function ZoomGate({ minZoom, children }: { minZoom: number; children: React.ReactNode }) {
  const z = useMapZoom();
  if (z < minZoom) return null;
  return <>{children}</>;
}

/**
 * Schätzt globalen Verschiebungsvektor zwischen zwei Niederschlags-Frames
 * via diskreter Kreuzkorrelation auf 32×32-Downsample. Rückgabe in
 * Original-Gridzellen. Nur für Prognose-Frame-Paare; einmal pro Paar.
 */
function estimateAdvection(
  a: number[],
  b: number[],
  nLat: number,
  nLon: number,
): { dx: number; dy: number } {
  const N = 32;
  const downA = new Float32Array(N * N);
  const downB = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const y0 = Math.floor((j * nLat) / N);
    const y1 = Math.max(y0 + 1, Math.floor(((j + 1) * nLat) / N));
    for (let i = 0; i < N; i++) {
      const x0 = Math.floor((i * nLon) / N);
      const x1 = Math.max(x0 + 1, Math.floor(((i + 1) * nLon) / N));
      let sa = 0;
      let sb = 0;
      let c = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sa += a[yy * nLon + xx] || 0;
          sb += b[yy * nLon + xx] || 0;
          c++;
        }
      }
      downA[j * N + i] = c ? sa / c : 0;
      downB[j * N + i] = c ? sb / c : 0;
    }
  }
  let energyA = 0;
  for (let k = 0; k < N * N; k++) energyA += downA[k] * downA[k];
  if (energyA < 1e-4) return { dx: 0, dy: 0 };

  const R = 4;
  let bestScore = -Infinity;
  let zeroScore = 0;
  let bestDx = 0;
  let bestDy = 0;
  for (let sdy = -R; sdy <= R; sdy++) {
    for (let sdx = -R; sdx <= R; sdx++) {
      let score = 0;
      const jStart = Math.max(0, -sdy);
      const jEnd = Math.min(N, N - sdy);
      const iStart = Math.max(0, -sdx);
      const iEnd = Math.min(N, N - sdx);
      for (let j = jStart; j < jEnd; j++) {
        for (let i = iStart; i < iEnd; i++) {
          score += downA[j * N + i] * downB[(j + sdy) * N + (i + sdx)];
        }
      }
      if (sdx === 0 && sdy === 0) zeroScore = score;
      if (score > bestScore) {
        bestScore = score;
        bestDx = sdx;
        bestDy = sdy;
      }
    }
  }
  // Nur akzeptieren, wenn die Korrelation klar besser ist als Null-Shift.
  if (bestScore < zeroScore * 1.05) return { dx: 0, dy: 0 };
  return { dx: bestDx * (nLon / N), dy: bestDy * (nLat / N) };
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
  contour = false,
}: {
  payload: RadarPayload;
  frame: RadarFrame | null;
  nextFrame?: RadarFrame | null;
  progress?: number;
  opacity?: number;
  contour?: boolean;
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
        cv.style.filter = contour ? "contrast(1.4)" : "blur(0.8px) contrast(2.2)";
        (cv.style as unknown as { imageRendering: string }).imageRendering = "auto";
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
    const tRaw = nextVals && typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : 0;
    // Smoothstep-Easing → weichere Übergänge zwischen 15-min-Frames.
    const t = tRaw * tRaw * (3 - 2 * tRaw);
    const lerp = (a: number, b: number) => a + (b - a) * t;

    // Advektion: in Prognose globalen Verschiebungsvektor verwenden, damit
    // Bänder sanft "fliessen" statt zu pulsieren. Dezent (gain 0.4, clamp 1.5).
    let adx = 0;
    let ady = 0;
    if (contour && nextVals) {
      const raw = advectionRef.current;
      adx = raw.dx * 0.4;
      ady = raw.dy * 0.4;
      const mag = Math.hypot(adx, ady);
      if (mag > 1.5) {
        adx = (adx / mag) * 1.5;
        ady = (ady / mag) * 1.5;
      }
    }
    const useAdv = adx !== 0 || ady !== 0;

    // STEP=2: Off-screen-Buffer auf halber Auflösung pro Achse (1/4 Pixel)
    // → deutlich schnellere Redraws, stabile 60fps Animation.
    const STEP = 2;
    const lowW = Math.max(1, Math.ceil(size.x / STEP));
    const lowH = Math.max(1, Math.ceil(size.y / STEP));

    const img = ctx.createImageData(lowW, lowH);
    const data = img.data;

    // Bilineare Sample-Funktion, parametrisiert über (fx, fy) → erlaubt
    // advektives Sampling mit verschobenen Koordinaten.
    const sampleAt = (arr: number[], fx: number, fy: number) => {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const txL = fx - x0;
      const tyL = fy - y0;
      const inX0 = x0 >= 0 && x0 < nLon;
      const inX1 = x1 >= 0 && x1 < nLon;
      const inY0 = y0 >= 0 && y0 < nLat;
      const inY1 = y1 >= 0 && y1 < nLat;
      if ((!inX0 && !inX1) || (!inY0 && !inY1)) return 0;
      const v00 = inX0 && inY0 ? arr[y0 * nLon + x0] : 0;
      const v01 = inX1 && inY0 ? arr[y0 * nLon + x1] : 0;
      const v10 = inX0 && inY1 ? arr[y1 * nLon + x0] : 0;
      const v11 = inX1 && inY1 ? arr[y1 * nLon + x1] : 0;
      return (
        v00 * (1 - txL) * (1 - tyL) +
        v01 * txL * (1 - tyL) +
        v10 * (1 - txL) * tyL +
        v11 * txL * tyL
      );
    };

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

        let v: number;
        if (useAdv && nextVals) {
          const va = sampleAt(vals, fxRaw + t * adx, fyRaw + t * ady);
          const vb = sampleAt(nextVals, fxRaw - (1 - t) * adx, fyRaw - (1 - t) * ady);
          v = va + (vb - va) * t;
        } else {
          const vCur = sampleAt(vals, fxRaw, fyRaw);
          v = nextVals ? lerp(vCur, sampleAt(nextVals, fxRaw, fyRaw)) : vCur;
        }
        if (v < 0.1) continue;

        let snowFrac = 0;
        if (snowVals) {
          let sv: number;
          if (useAdv && nextSnowVals) {
            const sa = sampleAt(snowVals, fxRaw + t * adx, fyRaw + t * ady);
            const sb = sampleAt(nextSnowVals, fxRaw - (1 - t) * adx, fyRaw - (1 - t) * ady);
            sv = sa + (sb - sa) * t;
          } else {
            const svCur = sampleAt(snowVals, fxRaw, fyRaw);
            sv = nextSnowVals ? lerp(svCur, sampleAt(nextSnowVals, fxRaw, fyRaw)) : svCur;
          }
          if (v > 0.01) snowFrac = Math.max(0, Math.min(1, sv / v));
        }
        // contour=true (Prognose): diskrete Stufen → sichtbare Iso-Bänder mit
        // weichen Kurven aus dem bilinearen Skalarfeld. contour=false: weiche
        // Farbverläufe (Messung-Canvas / Fallback).
        const [r, g, b, a] = snowFrac > 0.3 ? snowColorFor(v) : contour ? colorFor(v) : colorForSmooth(v);
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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
    // 1. Letzter echter Radar-Messframe mit t <= now (keine Toleranz —
    //    sonst springt die Anzeige in den Forecast hinein).
    let latestRadarIdx = -1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.source !== "radar") continue;
      if (Date.parse(f.t) <= now) latestRadarIdx = i;
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
  if (frame.source === "icon-ch1") {
    return { label: "Prognose ICON-CH1", color: BRAND };
  }
  return { label: "Prognose ICON-CH2", color: "#7a4ca0" };
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
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const kind = frame?.source === "radar" ? "Messung" : "Prognose";
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
  const [speed, setSpeed] = useState(1); // 1× ≈ 1800ms pro Stunden-Prognoseframe
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
    const FRAME_MS = 1800 / speed;
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
  // Crossfade nur während Auto-Play: zwischen zwei Stundenframes weich
  // überblenden. Im Pause-Modus rastet jeder Frame fest auf seine Stunde —
  // keine künstliche Bewegung, keine "atmende" Animation.
  const nextFrame =
    playing && idx !== null && currentFrame
      ? frames[(idx + 1) % frames.length] ?? null
      : null;

  // Cross-Fade Canvas↔Canvas (Forecast) bzw. PNG↔PNG (Messung).
  const blendNext = nextFrame && !nextFrame.precipUrl && !currentFrame?.precipUrl ? nextFrame : null;
  // PNG-Messung: kein Crossfade — Snap zwischen Frames, damit Konvektion sichtbar
  // wandert statt am Ort zu pulsieren.
  const blendNextPng = null as RadarFrame | null;
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
  void frameMaxMmh;

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
          zoom={9.5}
          zoomSnap={0.5}
          zoomDelta={0.5}
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
          <GeoJSON
            data={REGION_OUTLINE}
            style={() => ({ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false })}
            interactive={false}
          />
          {data &&
            currentFrame &&
            (() => {
              const hasPng = !!currentFrame.precipUrl;
              const hasGrid = Array.isArray(currentFrame.values) && currentFrame.values.length > 0;
              const ib = currentFrame.imageBbox ?? data.imageBbox;
              const opacityVal = 0.75;

              return (
                <>
                  {hasGrid && !hasPng && (
                    <PrecipOverlay
                      payload={data}
                      frame={currentFrame}
                      nextFrame={blendNext}
                      progress={progress}
                      opacity={opacityVal}
                      contour={currentFrame.source !== "radar"}
                    />
                  )}
                  {hasPng && (
                    <ImageOverlay
                      key={`precip-${currentFrame.t}`}
                      url={currentFrame.precipUrl!}
                      bounds={[
                        [ib.minLat, ib.minLon],
                        [ib.maxLat, ib.maxLon],
                      ]}
                      opacity={blendNextPng ? opacityVal * (1 - progress) : opacityVal}
                      zIndex={460}
                      className="mch-precip"
                    />
                  )}
                  {hasPng && blendNextPng && (
                    <ImageOverlay
                      key={`precip-next-${blendNextPng.t}`}
                      url={blendNextPng.precipUrl!}
                      bounds={[
                        [ib.minLat, ib.minLon],
                        [ib.maxLat, ib.maxLon],
                      ]}
                      opacity={opacityVal * progress}
                      zIndex={461}
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
              opacity={0.8}
              className="hail-blackdots"
            />
          )}




          <ZoomGate minZoom={10.5}>
            {RADAR_CITIES.map((c) => (
              <Marker
                key={c.name}
                position={[c.lat, c.lon]}
                icon={cityIcon(c.name)}
                interactive={false}
                keyboard={false}
              />
            ))}
          </ZoomGate>
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
        <div className="pointer-events-none absolute right-3 top-24 z-[400] flex flex-col gap-0.5 rounded-md bg-card/95 p-1.5 text-[9px] shadow-md sm:p-2 sm:text-[10px]">
          <span className="mb-1 font-semibold text-foreground">mm/h</span>
          {[...SCALE].reverse().map((s) => (
            <div key={s.mmh} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-3 rounded-sm sm:h-3 sm:w-4"
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
              <span className="tabular-nums text-muted-foreground">{s.mmh}</span>
            </div>
          ))}
          <span className="mt-1.5 mb-0.5 font-semibold text-foreground">Schnee</span>
          {SNOW_SCALE.map((s) => (
            <div key={`snow-${s.mmh}`} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-3 rounded-sm sm:h-3 sm:w-4"
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




            <p className="mt-1.5 text-[10px] text-neutral-500">
              Aktualisiert am {fmtUpdatedAt(data.generatedAt)} · Quellen: MeteoSchweiz Radar (Messung) · MeteoSchweiz ICON-CH1/CH2 (Vorhersage bis +48 h)
            </p>



          </>
        )}
      </div>
    </div>
  );
}
