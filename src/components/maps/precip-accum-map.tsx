import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toPng } from "html-to-image";

import thurgauData from "@/data/thurgau.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RadarFrame } from "@/lib/radar.functions";

const THURGAU = thurgauData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

const MAP_CENTER: [number, number] = [47.575, 9.35];
const MAP_BOUNDS: [[number, number], [number, number]] = [
  [47.25, 8.65],
  [47.90, 9.95],
];

// Klassengrenzen mm (radar-ähnlich, Kachelmann/MeteoSchweiz). Harte Bänder, keine Interpolation.
const ACCUM_CLASSES: { min: number; max: number; rgb: [number, number, number]; label: string }[] = [
  { min: 0.3, max: 1,    rgb: [195, 220, 245], label: "0.3" },
  { min: 1,   max: 2,    rgb: [120, 170, 230], label: "1" },
  { min: 2,   max: 5,    rgb: [40, 110, 215],  label: "2" },
  { min: 5,   max: 10,   rgb: [20, 50, 165],   label: "5" },
  { min: 10,  max: 20,   rgb: [40, 170, 80],   label: "10" },
  { min: 20,  max: 30,   rgb: [245, 230, 50],  label: "20" },
  { min: 30,  max: 50,   rgb: [245, 160, 35],  label: "30" },
  { min: 50,  max: 75,   rgb: [230, 55, 35],   label: "50" },
  { min: 75,  max: 100,  rgb: [165, 30, 130],  label: "75" },
  { min: 100, max: 9999, rgb: [95, 15, 100],   label: "100+" },
];

function colorForAccum(mm: number): [number, number, number, number] {
  if (mm < ACCUM_CLASSES[0].min) return [0, 0, 0, 0];
  for (const c of ACCUM_CLASSES) {
    if (mm >= c.min && mm < c.max) return [c.rgb[0], c.rgb[1], c.rgb[2], 0.86];
  }
  return [0, 0, 0, 0];
}

interface AccumResult {
  values: number[];
  maxMm: number;
  firstT: string | null;
  lastT: string | null;
  sourceMix: string;
  framesUsed: number;
}

export function accumulatePrecip(
  frames: RadarFrame[],
  nPts: number,
  hours: number,
): AccumResult {
  const now = Date.now();
  const cutoff = now + hours * 3600_000;

  const forecast = frames
    .filter((f) => f.source === "icon-ch1" || f.source === "icon-ch2")
    .filter((f) => f.values && f.values.length === nPts)
    .map((f) => ({ tMs: Date.parse(f.t), source: f.source, values: f.values }))
    .filter((f) => f.tMs > now - 30 * 60_000)
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
    const endMs = Math.min(f.tMs, cutoff);
    const dtH = Math.max(0, (endMs - prevMs) / 3600_000);
    if (dtH > 0) {
      for (let i = 0; i < nPts; i++) accum[i] += f.values[i] * dtH;
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

// ---------- Heatmap → DataURL (für Leaflet ImageOverlay) ----------
// Bilineare Interpolation des mm-Wertes pro Pixel, danach Klassenfarbe.
// → weiche, geschwungene Bandkonturen, aber harte Farbsprünge zwischen Klassen.
function renderHeatmapDataUrl(
  values: number[],
  gridLat: number[],
  gridLon: number[],
): { url: string; bounds: [[number, number], [number, number]] } | null {
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  if (!nLat || !nLon || values.length !== nLat * nLon) return null;

  const UP = 8;
  const w = (nLon - 1) * UP;
  const h = (nLat - 1) * UP;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const latAsc = gridLat[nLat - 1] > gridLat[0];

  for (let py = 0; py < h; py++) {
    // py=0 → oberer Bildrand → größter lat
    const fyTop = py / UP;
    const fyGrid = latAsc ? nLat - 1 - fyTop : fyTop;
    const y0 = Math.max(0, Math.min(nLat - 2, Math.floor(fyGrid)));
    const y1 = y0 + 1;
    const ty = fyGrid - y0;
    for (let px = 0; px < w; px++) {
      const fx = px / UP;
      const x0 = Math.max(0, Math.min(nLon - 2, Math.floor(fx)));
      const x1 = x0 + 1;
      const tx = fx - x0;

      const v00 = values[y0 * nLon + x0];
      const v10 = values[y0 * nLon + x1];
      const v01 = values[y1 * nLon + x0];
      const v11 = values[y1 * nLon + x1];
      const v =
        v00 * (1 - tx) * (1 - ty) +
        v10 * tx * (1 - ty) +
        v01 * (1 - tx) * ty +
        v11 * tx * ty;

      if (v < ACCUM_CLASSES[0].min) continue;
      const [r, g, b, a] = colorForAccum(v);
      if (a === 0) continue;
      const idx = (py * w + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(img, 0, 0);

  // Bounds: Gitterpunkt-zu-Gitterpunkt (Pixel liegen direkt auf Gitterpunkten).
  const minLat = Math.min(gridLat[0], gridLat[nLat - 1]);
  const maxLat = Math.max(gridLat[0], gridLat[nLat - 1]);
  const minLon = gridLon[0];
  const maxLon = gridLon[nLon - 1];

  return {
    url: canvas.toDataURL("image/png"),
    bounds: [[minLat, minLon], [maxLat, maxLon]],
  };
}

// ---------- Export-PNG (standalone, ohne Basemap-Tiles) ----------
function renderExportCanvas(
  canvas: HTMLCanvasElement,
  payload: {
    values: number[];
    gridLat: number[];
    gridLon: number[];
    hours: number;
    firstT: string | null;
    lastT: string | null;
    maxMm: number;
    sourceMix: string;
  },
) {
  const W = 1280;
  const H = 760;
  const PAD = { top: 70, right: 28, bottom: 110, left: 28 };
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bbox = { minLat: 47.30, maxLat: 47.85, minLon: 8.80, maxLon: 9.80 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const project = (lat: number, lon: number): [number, number] => {
    const x = PAD.left + ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * innerW;
    const y = PAD.top + (1 - (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * innerH;
    return [x, y];
  };

  const drawFC = (
    fc: FeatureCollection,
    style: { fill?: string; stroke?: string; lineWidth?: number; alpha?: number },
  ) => {
    ctx.save();
    if (style.alpha != null) ctx.globalAlpha = style.alpha;
    for (const feat of fc.features) {
      const g = feat.geometry;
      if (!g) continue;
      const rings: number[][][] = [];
      if (g.type === "Polygon") rings.push(...(g.coordinates as number[][][]));
      else if (g.type === "MultiPolygon")
        for (const poly of g.coordinates as number[][][][]) rings.push(...poly);
      for (const r of rings) {
        ctx.beginPath();
        for (let i = 0; i < r.length; i++) {
          const [lon, lat] = r[i];
          const [x, y] = project(lat, lon);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
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
    ctx.restore();
  };

  // Hintergrund — gleicher Map-Background wie Leaflet
  ctx.fillStyle = "#ebefeb";
  ctx.fillRect(0, 0, W, H);
  // Schweiz-Fläche als sanftes Land-Substitut (statt swisstopo-Relief)
  drawFC(SWITZERLAND, { fill: "#f7faf7" });

  // Heatmap (bilineare Klassen-Zuordnung)
  const { values, gridLat, gridLon } = payload;
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  const heatImg = ctx.createImageData(innerW, innerH);
  const hd = heatImg.data;
  for (let py = 0; py < innerH; py++) {
    const lat = bbox.maxLat - (py / innerH) * (bbox.maxLat - bbox.minLat);
    const fy = ((lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
    if (fy < 0 || fy > nLat - 1) continue;
    const y0 = Math.max(0, Math.min(nLat - 2, Math.floor(fy)));
    const y1 = y0 + 1;
    const ty = fy - y0;
    for (let px = 0; px < innerW; px++) {
      const lon = bbox.minLon + (px / innerW) * (bbox.maxLon - bbox.minLon);
      const fx = ((lon - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
      if (fx < 0 || fx > nLon - 1) continue;
      const x0 = Math.max(0, Math.min(nLon - 2, Math.floor(fx)));
      const x1 = x0 + 1;
      const tx = fx - x0;

      const v00 = values[y0 * nLon + x0];
      const v10 = values[y0 * nLon + x1];
      const v01 = values[y1 * nLon + x0];
      const v11 = values[y1 * nLon + x1];
      const v =
        v00 * (1 - tx) * (1 - ty) +
        v10 * tx * (1 - ty) +
        v01 * (1 - tx) * ty +
        v11 * tx * ty;

      if (v < ACCUM_CLASSES[0].min) continue;
      const [r, g, b, a] = colorForAccum(v);
      if (a === 0) continue;
      const idx = (py * innerW + px) * 4;
      hd[idx] = r;
      hd[idx + 1] = g;
      hd[idx + 2] = b;
      hd[idx + 3] = Math.round(a * 255);
    }
  }
  const off = document.createElement("canvas");
  off.width = innerW;
  off.height = innerH;
  off.getContext("2d")!.putImageData(heatImg, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(off, PAD.left, PAD.top);
  ctx.restore();

  // See (über Heatmap, wie Leaflet-Reihenfolge)
  drawFC(LAKE, { fill: "#7ec8e3", alpha: 0.25 });
  drawFC(LAKE, { stroke: "#5ba8c8", lineWidth: 1.2 });
  // Schweiz-Grenze
  drawFC(SWITZERLAND, { stroke: "#0f172a", lineWidth: 1.4, alpha: 0.85 });
  // Thurgau-Grenze
  drawFC(THURGAU, { stroke: "#0f172a", lineWidth: 2.2, alpha: 0.95 });

  // Header
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 26px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`+${payload.hours} h Niederschlagssumme`, PAD.left, 36);
  ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  ctx.fillText(
    `Zeitraum: ${fmt(payload.firstT)} → ${fmt(payload.lastT)} (Lokalzeit)`,
    PAD.left,
    56,
  );

  // Max chip
  const chipText = `Max ${payload.maxMm.toFixed(1)} mm`;
  ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
  const chipW = ctx.measureText(chipText).width + 20;
  const chipH = 26;
  const chipX = W - PAD.right - chipW;
  const chipY = 22;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  const cr = 13;
  ctx.moveTo(chipX + cr, chipY);
  ctx.lineTo(chipX + chipW - cr, chipY);
  ctx.quadraticCurveTo(chipX + chipW, chipY, chipX + chipW, chipY + cr);
  ctx.lineTo(chipX + chipW, chipY + chipH - cr);
  ctx.quadraticCurveTo(chipX + chipW, chipY + chipH, chipX + chipW - cr, chipY + chipH);
  ctx.lineTo(chipX + cr, chipY + chipH);
  ctx.quadraticCurveTo(chipX, chipY + chipH, chipX, chipY + chipH - cr);
  ctx.lineTo(chipX, chipY + cr);
  ctx.quadraticCurveTo(chipX, chipY, chipX + cr, chipY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(chipText, chipX + 10, chipY + 17);

  // Legende: diskrete Klassen
  const legY = H - PAD.bottom + 36;
  const legX = PAD.left;
  const legW = W - PAD.left - PAD.right;
  const legH = 16;
  const n = ACCUM_CLASSES.length;
  const bw = legW / n;
  for (let i = 0; i < n; i++) {
    const c = ACCUM_CLASSES[i];
    ctx.fillStyle = `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`;
    ctx.fillRect(legX + i * bw, legY, bw, legH);
  }
  ctx.strokeStyle = "rgba(15,23,42,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(legX + 0.5, legY + 0.5, legW - 1, legH - 1);
  ctx.fillStyle = "#475569";
  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
  for (let i = 0; i < n; i++) {
    const label = ACCUM_CLASSES[i].label;
    const tx = legX + i * bw;
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, tx + bw / 2 - lw / 2, legY + legH + 14);
  }
  ctx.font = "500 10px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("mm Niederschlag (Klassen)", legX, legY + legH + 30);

  // Footer
  ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Modell: ${payload.sourceMix}`, PAD.left, H - 10);
  const src = "ICON-CH1/CH2 via Open-Meteo · oberthurgauerwetter.ch";
  const sw = ctx.measureText(src).width;
  ctx.fillText(src, W - PAD.right - sw, H - 10);
}

interface Props {
  hours: 12 | 24 | 48;
  frames: RadarFrame[];
  gridLat: number[];
  gridLon: number[];
}

export function PrecipAccumMap({ hours, frames, gridLat, gridLon }: Props) {
  const nPts = gridLat.length * gridLon.length;
  const accum = useMemo(
    () => accumulatePrecip(frames, nPts, hours),
    [frames, nPts, hours],
  );

  const [overlay, setOverlay] = useState<{
    url: string;
    bounds: [[number, number], [number, number]];
  } | null>(null);

  useEffect(() => {
    const r = renderHeatmapDataUrl(accum.values, gridLat, gridLon);
    setOverlay(r);
  }, [accum, gridLat, gridLon]);

  let pxOver1 = 0;
  for (let i = 0; i < accum.values.length; i++) if (accum.values[i] >= 1) pxOver1++;
  const pctWet = ((pxOver1 / accum.values.length) * 100).toFixed(0);

  const mapKeyRef = useRef(`map-${hours}-${Math.random()}`);

  const download = () => {
    try {
      const exportCanvas = document.createElement("canvas");
      renderExportCanvas(exportCanvas, {
        values: accum.values,
        gridLat,
        gridLon,
        hours,
        firstT: accum.firstT,
        lastT: accum.lastT,
        maxMm: accum.maxMm,
        sourceMix: accum.sourceMix,
      });
      const fileName = `niederschlag-${hours}h-${new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "")}.png`;
      const dataUrl = exportCanvas.toDataURL("image/png");

      const win = window.open("", "_blank");
      if (win && win.document) {
        win.document.open();
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:16px;gap:12px}
  .bar{display:flex;gap:8px;align-items:center}
  a.btn{display:inline-block;background:#22c55e;color:#0b1220;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:14px}
  a.btn:hover{background:#16a34a;color:#fff}
  img{max-width:100%;height:auto;border:1px solid #1e293b;border-radius:8px;background:#fff}
  .hint{font-size:12px;color:#94a3b8}
</style></head><body>
<div class="bar"><a class="btn" href="${dataUrl}" download="${fileName}">PNG speichern</a><span class="hint">oder Rechtsklick aufs Bild → „Bild speichern unter …"</span></div>
<img src="${dataUrl}" alt="${fileName}">
</body></html>`);
        win.document.close();
        toast.success("PNG geöffnet", { description: "Im neuen Tab speichern." });
        return;
      }

      exportCanvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Export fehlgeschlagen", {
            description: "Bitte Popups erlauben.",
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success("PNG-Download gestartet", { description: fileName });
      }, "image/png");
    } catch (e) {
      toast.error("Export fehlgeschlagen", { description: (e as Error).message });
    }
  };

  return (
    <Card className="overflow-hidden border-zinc-200/80 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 pt-5 pb-4 border-b border-zinc-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 tabular-nums">
              +{hours} h
            </span>
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Niederschlagssumme
            </h2>
          </div>
          <p className="text-xs text-zinc-500 tabular-nums">
            Max <span className="font-medium text-zinc-700">{accum.maxMm.toFixed(1)} mm</span> ·{" "}
            {pctWet}% der Fläche ≥ 1 mm · {accum.framesUsed} Frames · {accum.sourceMix}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={download} size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            PNG herunterladen
          </Button>
          <span className="text-[10px] text-zinc-400">
            Öffnet PNG in neuem Tab inkl. „Speichern"-Button.
          </span>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="h-[560px] w-full">
          <MapContainer
            key={mapKeyRef.current}
            center={MAP_CENTER}
            zoom={9.5}
            zoomSnap={0.5}
            zoomDelta={0.5}
            minZoom={8}
            maxZoom={13}
            maxBounds={MAP_BOUNDS}
            maxBoundsViscosity={1.0}
            scrollWheelZoom
            zoomControl={false}
            attributionControl
            style={{ height: "100%", width: "100%", background: "#ebefeb" }}
          >
            <TileLayer
              url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.7}
              attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · ICON-CH1/CH2'
            />
            <GeoJSON
              data={LAKE}
              style={() => ({ color: "#5ba8c8", weight: 1.2, fillColor: "#7ec8e3", fillOpacity: 0.25 })}
              interactive={false}
            />
            {overlay && (
              <ImageOverlay
                key={`accum-${hours}-${overlay.url.length}`}
                url={overlay.url}
                bounds={overlay.bounds}
                opacity={0.85}
                zIndex={460}
              />
            )}
            <GeoJSON
              data={SWITZERLAND}
              style={() => ({ color: "#0f172a", weight: 1.4, opacity: 0.85, fill: false })}
              interactive={false}
            />
            <GeoJSON
              data={THURGAU}
              style={() => ({ color: "#0f172a", weight: 2.2, opacity: 0.95, fill: false })}
              interactive={false}
            />
            <ZoomControl position="topright" />
          </MapContainer>
        </div>

        {/* Legende */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/60">
          <div className="flex items-stretch gap-0 w-full rounded-md overflow-hidden ring-1 ring-zinc-200">
            {ACCUM_CLASSES.map((c) => (
              <div
                key={c.min}
                className="flex-1 h-4"
                style={{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] font-medium text-zinc-500 tabular-nums">
            {ACCUM_CLASSES.map((c) => (
              <span key={c.min} className="flex-1 text-center">{c.label}</span>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">mm Niederschlag (Klassen)</p>
        </div>
      </CardContent>
    </Card>
  );
}
