import { useEffect, useMemo, useRef } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { Download } from "lucide-react";
import { toast } from "sonner";

import thurgauData from "@/data/thurgau.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import { SPOTS } from "@/data/spots";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RadarFrame } from "@/lib/radar.functions";

const THURGAU = thurgauData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

const VIEW_BBOX = { minLat: 47.30, maxLat: 47.85, minLon: 8.80, maxLon: 9.80 } as const;

// mm-Stufen (MeteoSchweiz-ähnlich) – Übergänge werden linear interpoliert.
const ACCUM_SCALE: { mm: number; rgb: [number, number, number] }[] = [
  { mm: 0.3, rgb: [220, 232, 245] },
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

function colorForAccumSmooth(mm: number): [number, number, number, number] {
  if (mm < ACCUM_SCALE[0].mm) return [0, 0, 0, 0];
  if (mm >= ACCUM_SCALE[ACCUM_SCALE.length - 1].mm) {
    const c = ACCUM_SCALE[ACCUM_SCALE.length - 1].rgb;
    return [c[0], c[1], c[2], 0.92];
  }
  for (let i = 0; i < ACCUM_SCALE.length - 1; i++) {
    const a = ACCUM_SCALE[i];
    const b = ACCUM_SCALE[i + 1];
    if (mm >= a.mm && mm < b.mm) {
      const t = (mm - a.mm) / (b.mm - a.mm);
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      // sanft einblendende Opazität bei kleinen Werten
      const alpha = Math.min(0.92, 0.55 + Math.min(1, mm / 10) * 0.37);
      return [r, g, bl, alpha];
    }
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

// ---------- Render ----------

const BASE_W = 1280;
const BASE_H = 760;
const PAD = { top: 70, right: 28, bottom: 110, left: 28 };

function makeProject(w: number, h: number) {
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  return (lat: number, lon: number): [number, number] => {
    const x =
      PAD.left + ((lon - VIEW_BBOX.minLon) / (VIEW_BBOX.maxLon - VIEW_BBOX.minLon)) * innerW;
    const y =
      PAD.top +
      (1 - (lat - VIEW_BBOX.minLat) / (VIEW_BBOX.maxLat - VIEW_BBOX.minLat)) * innerH;
    return [x, y];
  };
}

function drawGeoJson(
  ctx: CanvasRenderingContext2D,
  fc: FeatureCollection,
  project: (lat: number, lon: number) => [number, number],
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
}

interface RenderPayload {
  gridLat: number[];
  gridLon: number[];
  accum: number[];
  hours: number;
  firstT: string | null;
  lastT: string | null;
  maxMm: number;
  sourceMix: string;
}

function renderMap(
  canvas: HTMLCanvasElement,
  payload: RenderPayload,
  opts: { dpr: number; w: number; h: number },
) {
  const { dpr, w, h } = opts;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const project = makeProject(w, h);

  // Hintergrund
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // Schweiz
  drawGeoJson(ctx, SWITZERLAND, project, { fill: "#f1f5f9" });

  // Heatmap
  const { gridLat, gridLon, accum, hours } = payload;
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const img = ctx.createImageData(innerW, innerH);
  const data = img.data;

  for (let py = 0; py < innerH; py++) {
    const lat =
      VIEW_BBOX.maxLat - (py / innerH) * (VIEW_BBOX.maxLat - VIEW_BBOX.minLat);
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
        VIEW_BBOX.minLon + (px / innerW) * (VIEW_BBOX.maxLon - VIEW_BBOX.minLon);
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
      const [r, g, b, a] = colorForAccumSmooth(v);
      const idx = (py * innerW + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(a * 255);
    }
  }

  const off = document.createElement("canvas");
  off.width = innerW;
  off.height = innerH;
  off.getContext("2d")!.putImageData(img, 0, 0);
  // sehr leichter Blur für weichere Optik
  ctx.save();
  ctx.filter = "blur(0.6px)";
  ctx.drawImage(off, PAD.left, PAD.top);
  ctx.restore();

  // See
  drawGeoJson(ctx, LAKE, project, { fill: "#cfe4f5", stroke: "#7aa9c8", lineWidth: 0.8 });

  // Schweiz-Grenze
  drawGeoJson(ctx, SWITZERLAND, project, { stroke: "#cbd5e1", lineWidth: 1 });

  // Thurgau mit Schatten
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 6;
  drawGeoJson(ctx, THURGAU, project, { stroke: "#1e3a8a", lineWidth: 2.5 });
  ctx.restore();

  // Spots als Pill-Labels
  ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  for (const s of SPOTS) {
    const [x, y] = project(s.lat, s.lon);
    if (x < PAD.left || x > w - PAD.right) continue;
    if (y < PAD.top || y > h - PAD.bottom) continue;
    // Punkt
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Pill
    const label = s.name;
    const padX = 6;
    const padY = 3;
    const tw = ctx.measureText(label).width;
    const bx = x + 9;
    const by = y - 10 - padY * 2 - 9;
    const bw = tw + padX * 2;
    const bh = 18;
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + bw - radius, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
    ctx.lineTo(bx + bw, by + bh - radius);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
    ctx.lineTo(bx + radius, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(label, bx + padX, by + bh - 5);
  }

  // Header
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 26px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(`+${hours} h Niederschlagssumme`, PAD.left, 36);

  ctx.font = "500 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}. ${hh}:${mi}`;
  };
  ctx.fillText(
    `Zeitraum: ${fmt(payload.firstT)} → ${fmt(payload.lastT)} (Lokalzeit)`,
    PAD.left,
    56,
  );

  // Max-Chip oben rechts
  const chipText = `Max ${payload.maxMm.toFixed(1)} mm`;
  ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
  const chipW = ctx.measureText(chipText).width + 20;
  const chipH = 26;
  const chipX = w - PAD.right - chipW;
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

  // Legende: kontinuierlicher Gradient
  const legY = h - PAD.bottom + 36;
  const legX = PAD.left;
  const legW = w - PAD.left - PAD.right;
  const legH = 14;
  const grad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
  const minMm = ACCUM_SCALE[0].mm;
  const maxScale = ACCUM_SCALE[ACCUM_SCALE.length - 1].mm;
  for (const stop of ACCUM_SCALE) {
    const t = (Math.log(stop.mm) - Math.log(minMm)) / (Math.log(maxScale) - Math.log(minMm));
    const [r, g, b] = stop.rgb;
    grad.addColorStop(Math.max(0, Math.min(1, t)), `rgb(${r},${g},${b})`);
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  const lr = 7;
  ctx.moveTo(legX + lr, legY);
  ctx.lineTo(legX + legW - lr, legY);
  ctx.quadraticCurveTo(legX + legW, legY, legX + legW, legY + lr);
  ctx.lineTo(legX + legW, legY + legH - lr);
  ctx.quadraticCurveTo(legX + legW, legY + legH, legX + legW - lr, legY + legH);
  ctx.lineTo(legX + lr, legY + legH);
  ctx.quadraticCurveTo(legX, legY + legH, legX, legY + legH - lr);
  ctx.lineTo(legX, legY + lr);
  ctx.quadraticCurveTo(legX, legY, legX + lr, legY);
  ctx.closePath();
  ctx.fill();

  // Legenden-Ticks
  ctx.fillStyle = "#475569";
  ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
  const tickValues = [0.3, 1, 2, 5, 10, 20, 50, 100];
  for (const v of tickValues) {
    const t = (Math.log(v) - Math.log(minMm)) / (Math.log(maxScale) - Math.log(minMm));
    const tx = legX + Math.max(0, Math.min(1, t)) * legW;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(tx, legY + legH, 1, 4);
    const label = `${v} mm`;
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = "#475569";
    ctx.fillText(label, Math.max(legX, Math.min(legX + legW - lw, tx - lw / 2)), legY + legH + 18);
  }

  // Footer
  ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Modell: ${payload.sourceMix}`, PAD.left, h - 10);
  const src = "ICON-CH1/CH2 via Open-Meteo · oberthurgauerwetter.ch";
  const sw = ctx.measureText(src).width;
  ctx.fillText(src, w - PAD.right - sw, h - 10);
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

  const payload: RenderPayload = {
    gridLat,
    gridLon,
    accum: accum.values,
    hours,
    firstT: accum.firstT,
    lastT: accum.lastT,
    maxMm: accum.maxMm,
    sourceMix: accum.sourceMix,
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderMap(cv, payload, { dpr, w: BASE_W, h: BASE_H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accum, gridLat, gridLon, hours]);

  const download = () => {
    try {
      // Frisches Export-Canvas in 1× rendern → kleine, saubere PNG, robust.
      const exportCanvas = document.createElement("canvas");
      renderMap(exportCanvas, payload, { dpr: 1, w: BASE_W, h: BASE_H });
      const fileName = `niederschlag-${hours}h-${new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "")}.png`;

      const triggerBlobDownload = () => {
        exportCanvas.toBlob((blob) => {
          if (!blob) {
            openDataUrlFallback();
            return;
          }
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            toast.success("PNG-Download gestartet", { description: fileName });
          } catch {
            openDataUrlFallback();
          }
        }, "image/png");
      };

      const openDataUrlFallback = () => {
        try {
          const dataUrl = exportCanvas.toDataURL("image/png");
          const win = window.open();
          if (win) {
            win.document.write(
              `<title>${fileName}</title><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%;height:auto" alt="Niederschlag"></body>`,
            );
            toast.info("PNG im neuen Tab geöffnet", {
              description: "Rechtsklick → Bild speichern unter …",
            });
          } else {
            // Letzter Fallback: direkter Link in Toast.
            toast.error("Download blockiert", {
              description: "Bitte Popups erlauben oder Seite in neuem Tab öffnen.",
            });
          }
        } catch (e) {
          toast.error("Export fehlgeschlagen", {
            description: (e as Error).message,
          });
        }
      };

      triggerBlobDownload();
    } catch (e) {
      toast.error("Export fehlgeschlagen", { description: (e as Error).message });
    }
  };

  let pxOver1 = 0;
  for (let i = 0; i < accum.values.length; i++) if (accum.values[i] >= 1) pxOver1++;
  const pctWet = ((pxOver1 / accum.values.length) * 100).toFixed(0);

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
            Falls Preview blockiert: öffnet sich im neuen Tab.
          </span>
        </div>
      </div>
      <CardContent className="p-0 bg-zinc-50">
        <div className="overflow-x-auto">
          <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto" />
        </div>
      </CardContent>
    </Card>
  );
}
