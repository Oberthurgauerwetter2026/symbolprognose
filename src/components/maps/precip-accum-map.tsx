import { withErrorBoundary } from "@/components/app-error-boundary";
import { ForeignReliefLayers } from "./foreign-relief-layers";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, ZoomControl } from "react-leaflet";


import L from "leaflet";
import "leaflet/dist/leaflet.css";


import { LAKE, SWITZERLAND, THURGAU, OUTSIDE_MASK, OUTSIDE_CH_MASK, REGION_OUTLINE } from "./radar-base-geo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


// Gleiche Karte wie Radar, aber näher auf den Oberthurgau gezoomt.
const MAP_CENTER: [number, number] = [47.56, 9.32];
const MAP_ZOOM = 10;
const MAP_BOUNDS: [[number, number], [number, number]] = [
  [46.6, 7.4],
  [48.6, 11.6],
];

import { CityMarkers } from "./city-markers";

// Niederschlagssummen-Farbskala (mm) — identische MeteoSchweiz-CombiPrecip-

// Palette wie `radar-map.tsx` SCALE (gleiche RGB-Tripel, gleiche Reihenfolge),
// nur an mm-Summen statt mm/h gehängt. Harte Bänder, keine Interpolation —
// dadurch sehen Radar-Animation, ICON-CH-Forecast-Frames und Summen-Karte
// farblich konsistent aus.
const ACCUM_CLASSES: { min: number; max: number; rgb: [number, number, number]; label: string }[] = [
  { min:   0.3, max:    1, rgb: [150, 195, 235], label: "0.3" },
  { min:   1,   max:    3, rgb: [ 95, 155, 220], label: "1"   },
  { min:   3,   max:   10, rgb: [ 40,  90, 195], label: "3"   },
  { min:  10,   max:   20, rgb: [ 55, 170,  75], label: "10"  },
  { min:  20,   max:   40, rgb: [245, 220,  55], label: "20"  },
  { min:  40,   max:   60, rgb: [240, 140,  35], label: "40"  },
  { min:  60,   max:  100, rgb: [220,  40,  40], label: "60"  },
  { min: 100,   max: 9999, rgb: [170,  40, 180], label: "100+"},
];

// Neuschnee-Teppich (cm), von hellem Blau über Indigo zu Violett/Rosa.
const SNOW_CLASSES: typeof ACCUM_CLASSES = [
  { min: 0.5, max: 2, rgb: [205, 225, 245], label: "0.5" },
  { min: 2, max: 5, rgb: [150, 190, 235], label: "2" },
  { min: 5, max: 10, rgb: [95, 140, 215], label: "5" },
  { min: 10, max: 20, rgb: [90, 85, 195], label: "10" },
  { min: 20, max: 50, rgb: [150, 70, 190], label: "20" },
  { min: 50, max: 9999, rgb: [235, 160, 215], label: "50+" },
];

let ACTIVE_CLASSES = ACCUM_CLASSES;

function classIndexForAccum(mm: number): number {
  const CL = ACTIVE_CLASSES;
  if (mm < CL[0].min) return -1;
  for (let i = 0; i < CL.length; i++) {
    const c = CL[i];
    if (mm >= c.min && mm < c.max) return i;
  }
  return -1;
}

function colorForAccum(mm: number): [number, number, number, number] {
  const idx = classIndexForAccum(mm);
  if (idx < 0) return [0, 0, 0, 0];
  const c = ACCUM_CLASSES[idx];
  return [c.rgb[0], c.rgb[1], c.rgb[2], 1.0];
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

  const UP = 16;
  const w = (nLon - 1) * UP;
  const h = (nLat - 1) * UP;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const clsIdx = new Int8Array(w * h).fill(-1);

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

      const ci = classIndexForAccum(v);
      if (ci < 0) continue;
      const c = ACTIVE_CLASSES[ci];
      const idx = (py * w + px) * 4;
      data[idx] = c.rgb[0];
      data[idx + 1] = c.rgb[1];
      data[idx + 2] = c.rgb[2];
      data[idx + 3] = 255;
      clsIdx[py * w + px] = ci;
    }
  }

  // Zweiter Pass: feine Trennlinien zwischen Klassen.
  // Border wird auf der Pixelseite mit der HÖHEREN Klasse gezeichnet,
  // damit die Außenkontur der intensiveren Klasse scharf bleibt.
  // Farbe adaptiv: dunkle Linie auf hellen Klassen (0–4), helle Linie auf dunklen Klassen (5–9).
  const drawBorderAt = (p: number) => {
    const ci = clsIdx[p];
    if (ci < 0) return;
    const dark = ci <= 4;
    const i = p * 4;
    if (dark) {
      // dunkle Linie
      data[i] = 15;
      data[i + 1] = 23;
      data[i + 2] = 42;
      data[i + 3] = 230;
    } else {
      // helle Linie
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 250;
    }
  };

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const p = py * w + px;
      const ci = clsIdx[p];
      // Rechts
      if (px + 1 < w) {
        const pr = p + 1;
        const cr = clsIdx[pr];
        if (ci !== cr) {
          if (ci > cr) drawBorderAt(p);
          else drawBorderAt(pr);
        }
      }
      // Unten
      if (py + 1 < h) {
        const pd = p + w;
        const cd = clsIdx[pd];
        if (ci !== cd) {
          if (ci > cd) drawBorderAt(p);
          else drawBorderAt(pd);
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  // Weichzeichnungs-Pass: Bitmap durch Off-Screen-Blur → rundere Klassenkanten.
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext("2d");
  if (bctx) {
    bctx.filter = "blur(2px)";
    bctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(blurCanvas, 0, 0);
  }

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

interface Props {
  values: number[];
  gridLat: number[];
  gridLon: number[];
  mode: "rain" | "snow";
  hours: number;
  sourceLabel: string;
}

function PrecipAccumMapInner({ values, gridLat, gridLon, mode, hours, sourceLabel }: Props) {
  const classes = mode === "snow" ? SNOW_CLASSES : ACCUM_CLASSES;
  const unit = mode === "snow" ? "cm" : "mm";
  const accum = useMemo(() => {
    let maxMm = 0;
    for (const v of values) if (v > maxMm) maxMm = v;
    return { values, maxMm };
  }, [values]);

  const [overlay, setOverlay] = useState<{
    url: string;
    bounds: [[number, number], [number, number]];
  } | null>(null);

  useEffect(() => {
    ACTIVE_CLASSES = classes;
    setOverlay(renderHeatmapDataUrl(accum.values, gridLat, gridLon));
  }, [accum, gridLat, gridLon, classes]);

  let pxOver1 = 0;
  for (let i = 0; i < accum.values.length; i++) if (accum.values[i] >= (mode === "snow" ? 0.5 : 1)) pxOver1++;
  const pctWet = ((pxOver1 / accum.values.length) * 100).toFixed(0);

  const mapKeyRef = useRef(`map-${Math.random()}`);
  const cardRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!cardRef.current) return;
    try {
      // Kurz warten, damit ggf. noch ausstehende Tile-Loads abgeschlossen sind.
      await new Promise((r) => setTimeout(r, 250));
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        // Leaflet-Controls (Zoom-Buttons, Attribution) im Export weglassen
        filter: (node: HTMLElement) => {
          if (!(node instanceof HTMLElement)) return true;
          // Zoom-Buttons aus dem Export ausblenden, Attribution behalten.
          if (node.classList?.contains("leaflet-control-zoom")) return false;
          if (node.dataset && "exportExclude" in node.dataset) return false;
          return true;
        },
      });

      const fileName = `${mode === "snow" ? "neuschnee" : "niederschlag"}-${hours}h-${new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[-:T]/g, "")}.png`;

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

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("PNG-Download gestartet", { description: fileName });
    } catch (e) {
      toast.error("Export fehlgeschlagen", {
        description:
          (e as Error).message ||
          "Karte noch nicht vollständig geladen — kurz warten und erneut versuchen.",
      });
    }
  };

  return (
    <Card ref={cardRef} className="overflow-hidden border-zinc-200/80 shadow-sm bg-white">
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 pt-5 pb-4 border-b border-zinc-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 tabular-nums">
              letzte {hours} h
            </span>
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
              {mode === "snow" ? "Neuschnee" : "Gefallener Niederschlag"}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 tabular-nums">
            Max <span className="font-medium text-zinc-700">{accum.maxMm.toFixed(1)} {unit}</span> ·{" "}
            {pctWet}% der Fläche ≥ {mode === "snow" ? "0.5 cm" : "1 mm"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1" data-export-exclude>
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
        <div className="map-attrib-compact relative h-[clamp(380px,60vh,620px)] w-full">
          <style>{`
            .leaflet-tooltip.city-label {
              background: rgba(255,255,255,0.85);
              border: none;
              box-shadow: 0 1px 2px rgba(0,0,0,0.15);
              color: #0f172a;
              font-size: 11px;
              font-weight: 600;
              padding: 1px 5px;
              border-radius: 4px;
              white-space: nowrap;
            }
            .leaflet-tooltip.city-label::before { display: none; }
          `}</style>


          <MapContainer
            key={mapKeyRef.current}
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            zoomSnap={0.5}
            zoomDelta={0.5}
            minZoom={9}
            maxZoom={15}
            maxBounds={MAP_BOUNDS}
            maxBoundsViscosity={1.0}
            scrollWheelZoom
            zoomControl={false}
            attributionControl
            style={{ height: "100%", width: "100%", background: "#ebefeb" }}
          >
            <ForeignReliefLayers />
            <TileLayer
              url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.9}
              crossOrigin="anonymous"
              attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz ICON-CH1/CH2'
            />
            <GeoJSON
              data={OUTSIDE_CH_MASK}
              style={() => ({ stroke: false, fillColor: "#3a4148", fillOpacity: 0.3 })}
              interactive={false}
            />
            <GeoJSON
              data={OUTSIDE_MASK}
              style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.18 })}
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
              data={LAKE}
              style={() => ({ color: "#5ba8c8", weight: 1.2, fillColor: "#d7e9ee", fillOpacity: 1 })}
              interactive={false}
            />
            <GeoJSON
              data={REGION_OUTLINE}
              style={() => ({ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false })}
              interactive={false}
            />
            {overlay && (
              <ImageOverlay
                key={`accum-${mode}-${hours}-${overlay.url.length}`}
                url={overlay.url}
                bounds={overlay.bounds}
                opacity={0.7}
                zIndex={460}
              />
            )}
            <CityMarkers />
            <ZoomControl position="topright" />
          </MapContainer>

          {/* Floating-Legende */}
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] rounded-2xl bg-white/85 backdrop-blur-md ring-1 ring-zinc-900/10 shadow-lg px-3 py-2"
            style={{ width: "min(420px, calc(100% - 24px))" }}
          >
            <div className="flex justify-between text-[10px] font-semibold text-zinc-600 tabular-nums mb-1 px-[2px]">
              {classes.map((c) => (
                <span key={c.min} className="flex-1 text-center">{c.label}</span>
              ))}
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-zinc-900/10">
              {classes.map((c) => (
                <div
                  key={c.min}
                  className="flex-1"
                  style={{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }}
                />
              ))}
            </div>
            <p className="text-[9px] text-zinc-500 mt-1 text-center tracking-wide uppercase">{mode === "snow" ? "cm Neuschnee" : "mm Niederschlag"}</p>
          </div>
        </div>
        <div className="mt-2 text-left text-[11px] text-muted-foreground">
          Quelle: Oberthurgauer Wetter · {sourceLabel}
        </div>
      </CardContent>
    </Card>
  );
}


/** Öffentliche Variante mit Fehler-Auffangbereich (keine weisse Seite). */
export const PrecipAccumMap = withErrorBoundary(PrecipAccumMapInner, "Die Niederschlagssumme", 360);
