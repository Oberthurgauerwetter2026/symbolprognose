import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, ZoomControl, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


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

const CITIES: { name: string; lat: number; lon: number; minZoom?: number }[] = [
  // Tier A — Hauptorte (ab Zoom 10.5)
  { name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { name: "Romanshorn", lat: 47.5667, lon: 9.3786 },
  { name: "Arbon", lat: 47.5158, lon: 9.4339 },
  { name: "Horn", lat: 47.4986, lon: 9.4470 },
  { name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { name: "Egnach", lat: 47.5444, lon: 9.3833 },
  { name: "Güttingen", lat: 47.6011, lon: 9.2917 },
  // Tier B — mittelgrosse Gemeinden (ab Zoom 11.5)
  { name: "Roggwil", lat: 47.4769, lon: 9.3922, minZoom: 11.5 },
  { name: "Uttwil", lat: 47.5907, lon: 9.3367, minZoom: 11.5 },
  { name: "Salmsach", lat: 47.5503, lon: 9.3725, minZoom: 11.5 },
  { name: "Sommeri", lat: 47.5775, lon: 9.3194, minZoom: 11.5 },
  { name: "Erlen", lat: 47.5375, lon: 9.2378, minZoom: 11.5 },
  { name: "Langrickenbach", lat: 47.5947, lon: 9.2406, minZoom: 11.5 },
  // Tier C — kleine Gemeinden / Ortsteile (ab Zoom 12.5)
  { name: "Hefenhofen", lat: 47.5722, lon: 9.3289, minZoom: 12.5 },
  { name: "Dozwil", lat: 47.5867, lon: 9.3047, minZoom: 12.5 },
  { name: "Kesswil", lat: 47.6022, lon: 9.3217, minZoom: 12.5 },
  { name: "Hauptwil-Gottshaus", lat: 47.4894, lon: 9.2806, minZoom: 12.5 },
  { name: "Zihlschlacht-Sitterdorf", lat: 47.5158, lon: 9.2750, minZoom: 12.5 },
  { name: "Bischofszell", lat: 47.4944, lon: 9.2389, minZoom: 12.5 },
];

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

function cityIcon(name: string): L.DivIcon {
  const bullet =
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2561a1;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;line-height:1;margin-right:4px;vertical-align:middle;";
  const label =
    "font:500 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;vertical-align:middle;";
  return L.divIcon({
    className: "accum-city-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function CityMarkers() {
  const z = useMapZoom();
  return (
    <>
      {CITIES.filter((c) => z >= (c.minZoom ?? 10.5)).map((c) => (
        <Marker
          key={c.name}
          position={[c.lat, c.lon]}
          icon={cityIcon(c.name)}
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}

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

function classIndexForAccum(mm: number): number {
  if (mm < ACCUM_CLASSES[0].min) return -1;
  for (let i = 0; i < ACCUM_CLASSES.length; i++) {
    const c = ACCUM_CLASSES[i];
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
      const c = ACCUM_CLASSES[ci];
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

      const fileName = `niederschlag-${hours}h-${new Date()
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
        <div className="relative h-[560px] w-full">
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
              opacity={0.85}
              crossOrigin="anonymous"
              attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz ICON-CH1 → ICON-CH2'
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
                opacity={0.7}
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
            <CityMarkers />
            <ZoomControl position="topright" />
          </MapContainer>

          {/* Floating-Legende */}
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] rounded-2xl bg-white/85 backdrop-blur-md ring-1 ring-zinc-900/10 shadow-lg px-3 py-2"
            style={{ width: "min(420px, calc(100% - 24px))" }}
          >
            <div className="flex justify-between text-[10px] font-semibold text-zinc-600 tabular-nums mb-1 px-[2px]">
              {ACCUM_CLASSES.map((c) => (
                <span key={c.min} className="flex-1 text-center">{c.label}</span>
              ))}
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-zinc-900/10">
              {ACCUM_CLASSES.map((c) => (
                <div
                  key={c.min}
                  className="flex-1"
                  style={{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }}
                />
              ))}
            </div>
            <p className="text-[9px] text-zinc-500 mt-1 text-center tracking-wide uppercase">mm Niederschlag</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
