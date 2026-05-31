import { useEffect, useMemo, useRef } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { Download } from "lucide-react";

import thurgauData from "@/data/thurgau.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import { SPOTS } from "@/data/spots";
import type { RadarFrame } from "@/lib/radar.functions";

const THURGAU = thurgauData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

// Anzeige-Bbox (etwas grösser als Thurgau, damit Bodensee und Nachbar­regionen
// sichtbar sind). Bewusst kleiner als die Daten-Bbox (46.85–48.30 / 8.15–10.55).
const VIEW_BBOX = { minLat: 47.30, maxLat: 47.85, minLon: 8.80, maxLon: 9.80 } as const;

// Akkumulations-Farbskala (mm). Angelehnt an MeteoSchweiz-Tagessummen-Karte.
const ACCUM_SCALE: { mm: number; rgb: [number, number, number] }[] = [
  { mm: 0.5, rgb: [200, 220, 240] },
  { mm: 1, rgb: [160, 200, 240] },
  { mm: 2, rgb: [100, 160, 230] },
  { mm: 5, rgb: [40, 100, 210] },
  { mm: 10, rgb: [30, 160, 70] },
  { mm: 20, rgb: [240, 220, 50] },
  { mm: 30, rgb: [240, 160, 40] },
  { mm: 50, rgb: [230, 60, 40] },
  { mm: 75, rgb: [170, 30, 140] },
  { mm: 100, rgb: [110, 20, 110] },
];

function colorForAccum(mm: number): [number, number, number, number] {
  if (mm < ACCUM_SCALE[0].mm) return [0, 0, 0, 0];
  let band = ACCUM_SCALE[0];
  for (let i = ACCUM_SCALE.length - 1; i >= 0; i--) {
    if (mm >= ACCUM_SCALE[i].mm) {
      band = ACCUM_SCALE[i];
      break;
    }
  }
  return [band.rgb[0], band.rgb[1], band.rgb[2], 0.88];
}

interface AccumResult {
  values: number[]; // mm pro Grid-Punkt (row-major: y * nLon + x)
  maxMm: number;
  firstT: string | null;
  lastT: string | null;
  sourceMix: string;
  framesUsed: number;
}

/**
 * Akkumuliert mm pro Pixel über das nächste `hours`-Fenster.
 * Annahme: `frames[i].values` ist in mm/h, dt = (t_i - t_{i-1}) in Stunden.
 * Nutzt nur Frames mit `source` in `icon-ch1` | `icon-ch2` (Prognose, kein Radar).
 */
export function accumulatePrecip(
  frames: RadarFrame[],
  nPts: number,
  hours: number,
): AccumResult {
  const now = Date.now();
  const cutoff = now + hours * 3600_000;

  // Nur Prognose-Frames, sortiert.
  const forecast = frames
    .filter((f) => f.source === "icon-ch1" || f.source === "icon-ch2")
    .filter((f) => f.values && f.values.length === nPts)
    .map((f) => ({ tMs: Date.parse(f.t), source: f.source, values: f.values }))
    .filter((f) => f.tMs > now - 30 * 60_000) // kleine Toleranz nach hinten
    .sort((a, b) => a.tMs - b.tMs);

  const accum = new Array<number>(nPts).fill(0);
  let prevMs = now;
  let firstT: string | null = null;
  let lastT: string | null = null;
  const srcSet = new Set<string>();
  let used = 0;

  for (const f of forecast) {
    if (f.tMs <= now) {
      prevMs = f.tMs;
      continue;
    }
    if (prevMs >= cutoff) break;
    // Endzeit dieses Intervalls auf cutoff begrenzen.
    const endMs = Math.min(f.tMs, cutoff);
    const dtH = Math.max(0, (endMs - prevMs) / 3600_000);
    if (dtH > 0) {
      for (let i = 0; i < nPts; i++) {
        accum[i] += f.values[i] * dtH;
      }
      used++;
      srcSet.add(f.source);
      if (!firstT) firstT = new Date(prevMs).toISOString();
      lastT = new Date(endMs).toISOString();
    }
    prevMs = f.tMs;
    if (prevMs >= cutoff) break;
  }

  let maxMm = 0;
  for (let i = 0; i < accum.length; i++) if (accum[i] > maxMm) maxMm = accum[i];

  return {
    values: accum,
    maxMm,
    firstT,
    lastT,
    sourceMix: [...srcSet].join(" + ") || "—",
    framesUsed: used,
  };
}

// --------- Render-Helfer (Canvas, lat/lon → px) ---------

const CANVAS_W = 1200;
const CANVAS_H = 720;
const PAD = { top: 56, right: 24, bottom: 96, left: 24 };

function project(lat: number, lon: number): [number, number] {
  const innerW = CANVAS_W - PAD.left - PAD.right;
  const innerH = CANVAS_H - PAD.top - PAD.bottom;
  const x =
    PAD.left + ((lon - VIEW_BBOX.minLon) / (VIEW_BBOX.maxLon - VIEW_BBOX.minLon)) * innerW;
  const y =
    PAD.top +
    (1 - (lat - VIEW_BBOX.minLat) / (VIEW_BBOX.maxLat - VIEW_BBOX.minLat)) * innerH;
  return [x, y];
}

function ringPath(ctx: CanvasRenderingContext2D, ring: number[][]) {
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const [x, y] = project(lat, lon);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function drawGeoJson(
  ctx: CanvasRenderingContext2D,
  fc: FeatureCollection,
  style: { fill?: string; stroke?: string; lineWidth?: number },
) {
  for (const feature of fc.features as Feature[]) {
    const g = feature.geometry;
    if (!g) continue;
    const rings: number[][][] = [];
    if (g.type === "Polygon") for (const r of (g as Polygon).coordinates) rings.push(r);
    else if (g.type === "MultiPolygon")
      for (const p of (g as MultiPolygon).coordinates) for (const r of p) rings.push(r);
    for (const r of rings) {
      ringPath(ctx, r);
      if (style.fill) {
        ctx.fillStyle = style.fill;
        ctx.fill();
      }
      if (style.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth ?? 1;
        ctx.stroke();
      }
    }
  }
}

function renderMapToCanvas(
  canvas: HTMLCanvasElement,
  payload: {
    gridLat: number[];
    gridLon: number[];
    accum: number[];
    hours: number;
    firstT: string | null;
    lastT: string | null;
    maxMm: number;
    sourceMix: string;
  },
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = CANVAS_W + "px";
  canvas.style.height = CANVAS_H + "px";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Hintergrund
  ctx.fillStyle = "#f5f7fa";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Schweiz-Umriss als heller Layer.
  drawGeoJson(ctx, SWITZERLAND, { fill: "#ffffff" });

  // Heatmap (akkumulierte mm) mit bilinearer Interpolation.
  const { gridLat, gridLon, accum, hours } = payload;
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  const innerW = CANVAS_W - PAD.left - PAD.right;
  const innerH = CANVAS_H - PAD.top - PAD.bottom;
  const img = ctx.createImageData(innerW, innerH);
  const data = img.data;

  for (let py = 0; py < innerH; py++) {
    const lat =
      VIEW_BBOX.maxLat -
      (py / innerH) * (VIEW_BBOX.maxLat - VIEW_BBOX.minLat);
    const fyRaw =
      ((lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
    const y0 = Math.floor(fyRaw);
    const y1 = y0 + 1;
    const ty = fyRaw - y0;
    const inY0 = y0 >= 0 && y0 < nLat;
    const inY1 = y1 >= 0 && y1 < nLat;
    if (!inY0 && !inY1) continue;
    for (let px = 0; px < innerW; px++) {
      const lon =
        VIEW_BBOX.minLon +
        (px / innerW) * (VIEW_BBOX.maxLon - VIEW_BBOX.minLon);
      const fxRaw =
        ((lon - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
      const x0 = Math.floor(fxRaw);
      const x1 = x0 + 1;
      const tx = fxRaw - x0;
      const inX0 = x0 >= 0 && x0 < nLon;
      const inX1 = x1 >= 0 && x1 < nLon;
      if (!inX0 && !inX1) continue;
      const v00 = inX0 && inY0 ? accum[y0 * nLon + x0] : 0;
      const v01 = inX1 && inY0 ? accum[y0 * nLon + x1] : 0;
      const v10 = inX0 && inY1 ? accum[y1 * nLon + x0] : 0;
      const v11 = inX1 && inY1 ? accum[y1 * nLon + x1] : 0;
      const v =
        v00 * (1 - tx) * (1 - ty) +
        v01 * tx * (1 - ty) +
        v10 * (1 - tx) * ty +
        v11 * tx * ty;
      if (v < ACCUM_SCALE[0].mm) continue;
      const [r, g, b, a] = colorForAccum(v);
      const idx = (py * innerW + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(a * 255);
    }
  }

  // Heatmap-ImageData via Offscreen-Canvas einsetzen.
  const off = document.createElement("canvas");
  off.width = innerW;
  off.height = innerH;
  off.getContext("2d")!.putImageData(img, 0, 0);
  ctx.drawImage(off, PAD.left, PAD.top);

  // See als Wasser-Layer drüber.
  drawGeoJson(ctx, LAKE, { fill: "#cfe4f5", stroke: "#7aa9c8", lineWidth: 0.8 });

  // Schweiz-Grenze als feine Linie.
  drawGeoJson(ctx, SWITZERLAND, { stroke: "#94a3b8", lineWidth: 1 });

  // Thurgau-Umriss kräftig hervorheben.
  drawGeoJson(ctx, THURGAU, { stroke: "#2561a1", lineWidth: 2 });

  // Ortspunkte + Labels
  ctx.font = "600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  for (const s of SPOTS) {
    const [x, y] = project(s.lat, s.lon);
    if (x < PAD.left || x > CANVAS_W - PAD.right) continue;
    if (y < PAD.top || y > CANVAS_H - PAD.bottom) continue;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2561a1";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Label mit weissem Halo
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(s.name, x + 7, y - 5);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(s.name, x + 7, y - 5);
  }

  // Titel oben links
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(
    `Niederschlagssumme nächste ${hours} h`,
    PAD.left,
    34,
  );

  // Zeitstempel oben rechts
  ctx.font = "500 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "#475569";
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}. ${hh}:${mi}`;
  };
  const periodText = `${fmt(payload.firstT)} → ${fmt(payload.lastT)} (Lokalzeit)`;
  const tw = ctx.measureText(periodText).width;
  ctx.fillText(periodText, CANVAS_W - PAD.right - tw, 34);

  // Legende unten (Farbband mit mm-Werten)
  const legY = CANVAS_H - PAD.bottom + 28;
  const legX = PAD.left;
  const legW = CANVAS_W - PAD.left - PAD.right;
  const stepW = legW / ACCUM_SCALE.length;
  for (let i = 0; i < ACCUM_SCALE.length; i++) {
    const [r, g, b] = ACCUM_SCALE[i].rgb;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(legX + i * stepW, legY, stepW - 1, 22);
  }
  ctx.fillStyle = "#1f2937";
  ctx.font = "500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  for (let i = 0; i < ACCUM_SCALE.length; i++) {
    const label = `≥ ${ACCUM_SCALE[i].mm} mm`;
    const tx = legX + i * stepW + 4;
    ctx.fillText(label, tx, legY + 38);
  }
  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(
    `Maximum: ${payload.maxMm.toFixed(1)} mm  ·  Modell: ${payload.sourceMix}`,
    legX,
    CANVAS_H - 10,
  );

  // Quelle unten rechts
  ctx.font = "500 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  const src = "Quelle: ICON-CH1/CH2 via Open-Meteo · oberthurgauerwetter.ch";
  const sw = ctx.measureText(src).width;
  ctx.fillText(src, CANVAS_W - PAD.right - sw, CANVAS_H - 10);
}

interface Props {
  hours: 12 | 24 | 48;
  frames: RadarFrame[];
  gridLat: number[];
  gridLon: number[];
}

export function PrecipAccumMap({ hours, frames, gridLat, gridLon }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nPts = gridLat.length * gridLon.length;

  const accum = useMemo(
    () => accumulatePrecip(frames, nPts, hours),
    [frames, nPts, hours],
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    renderMapToCanvas(cv, {
      gridLat,
      gridLon,
      accum: accum.values,
      hours,
      firstT: accum.firstT,
      lastT: accum.lastT,
      maxMm: accum.maxMm,
      sourceMix: accum.sourceMix,
    });
  }, [accum, gridLat, gridLon, hours]);

  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `niederschlag-${hours}h-${today}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  // Pixel über 1 mm (kurze Statistik)
  let pxOver1 = 0;
  for (let i = 0; i < accum.values.length; i++) if (accum.values[i] >= 1) pxOver1++;
  const pctWet = ((pxOver1 / accum.values.length) * 100).toFixed(0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Akkumulation +{hours} h
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Max {accum.maxMm.toFixed(1)} mm · {pctWet}% der Fläche ≥ 1 mm ·
            {" "}{accum.framesUsed} Frames · {accum.sourceMix}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-3 py-2 rounded-sm"
        >
          <Download className="h-4 w-4" />
          PNG herunterladen
        </button>
      </div>
      <div className="overflow-x-auto border border-zinc-200 rounded-md bg-white">
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
      </div>
    </div>
  );
}
