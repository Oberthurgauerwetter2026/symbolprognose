import { withErrorBoundary } from "@/components/app-error-boundary";
import { SourceFooter } from "@/components/source-footer";
import { ForeignReliefLayers } from "./foreign-relief-layers";
import { DockZoomControl } from "./map-dock";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, Marker, Tooltip, useMapEvents, useMap } from "react-leaflet";


import L from "leaflet";
import "leaflet/dist/leaflet.css";


import { LAKE, SWITZERLAND, THURGAU, OUTSIDE_MASK, OUTSIDE_CH_MASK, REGION_OUTLINE } from "./radar-base-geo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, ChartNoAxesCombined, MapPin, Snowflake } from "lucide-react";


// Gleiche Karte wie Radar, aber näher auf den Oberthurgau gezoomt.
const MAP_CENTER: [number, number] = [47.56, 9.32];
const MAP_ZOOM = 9;
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
  { min:   0.3, max:    1, rgb: [134, 188, 236], label: "0.3" },
  { min:   1,   max:    3, rgb: [109, 162, 222], label: "1"   },
  { min:   3,   max:   10, rgb: [ 66, 111, 200], label: "3"   },
  { min:  10,   max:   20, rgb: [ 80, 178,  96], label: "10"  },
  { min:  20,   max:   40, rgb: [243, 215,  81], label: "20"  },
  { min:  40,   max:   60, rgb: [240, 150,  60], label: "40"  },
  { min:  60,   max:  100, rgb: [220,  70,  70], label: "60"  },
  { min: 100,   max: 9999, rgb: [177,  72, 187], label: "100+"},
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

function classIndexForAccum(mm: number, CL = ACCUM_CLASSES): number {
  if (mm < CL[0].min) return -1;
  for (let i = 0; i < CL.length; i++) {
    const c = CL[i];
    if (mm >= c.min && mm < c.max) return i;
  }
  return -1;
}

import { sampleAccumCell } from "./accum-sampling";

// ---------- Heatmap → DataURL (für Leaflet ImageOverlay) ----------
// Monotone Catmull-Rom-Interpolation des mm-Wertes pro Pixel, danach Klassenfarbe.
// → weiche, geschwungene Bandkonturen, aber harte Farbsprünge zwischen Klassen.
function renderHeatmapDataUrl(
  values: number[],
  gridLat: number[],
  gridLon: number[],
  classes: typeof ACCUM_CLASSES,
): { url: string; bounds: [[number, number], [number, number]] } | null {
  const nLat = gridLat.length;
  const nLon = gridLon.length;
  if (!nLat || !nLon || values.length !== nLat * nLon) return null;

  // Rund 2000 Bildpixel: auch beim lokalen Zoom fein aufgelöste Bandkonturen.
  // Mengenklassen und Deckkraft bleiben unverändert; keine Farbmischung.
  const UP = Math.max(1, Math.min(256, Math.round(2000 / Math.max(1, nLon - 1))));
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
    const ty = fyGrid - y0;
    for (let px = 0; px < w; px++) {
      const fx = px / UP;
      const x0 = Math.max(0, Math.min(nLon - 2, Math.floor(fx)));
      const tx = fx - x0;

      // Catmull-Rom (bikubisch) wie im Radar-Ingest: organische Bandkanten,
      // monoton an den Zell-Eckwerten begrenzt — sonst rechnet die
      // bikubische Seitenkeule ringförmige Löcher in flächige 0.3-mm-Gebiete.
      const v = sampleAccumCell(values, nLat, nLon, y0, x0, tx, ty);

      const ci = classIndexForAccum(v, classes);
      if (ci < 0) continue;
      const c = classes[ci];
      const idx = (py * w + px) * 4;
      data[idx] = c.rgb[0];
      data[idx + 1] = c.rgb[1];
      data[idx + 2] = c.rgb[2];
      data[idx + 3] = 255;
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

function valueAt(values: number[], gridLat: number[], gridLon: number[], lat: number, lon: number): number | null {
  const nLat = gridLat.length, nLon = gridLon.length;
  if (nLat < 2 || nLon < 2) return null;
  const fy = ((lat - gridLat[0]) / (gridLat[nLat - 1] - gridLat[0])) * (nLat - 1);
  const fx = ((lon - gridLon[0]) / (gridLon[nLon - 1] - gridLon[0])) * (nLon - 1);
  if (!(fy >= 0 && fy <= nLat - 1 && fx >= 0 && fx <= nLon - 1)) return null;
  const y0 = Math.min(nLat - 2, Math.floor(fy));
  const x0 = Math.min(nLon - 2, Math.floor(fx));
  return sampleAccumCell(values, nLat, nLon, y0, x0, fx - x0, fy - y0);
}

type Hover = { x: number; y: number; v: number } | null;

function SnowMapFraming({ mode }: { mode: "rain" | "snow" }) {
  const map = useMap();
  useEffect(() => {
    // Keep the alpine snow area clear of the legend without changing rain framing.
    map.setView(mode === "snow" ? [47.43, 9.32] : MAP_CENTER, mode === "snow" ? 9.5 : MAP_ZOOM, { animate: false });
  }, [map, mode]);
  return null;
}

function HoverProbe({ values, gridLat, gridLon, onHover }: { values: number[]; gridLat: number[]; gridLon: number[]; onHover: (h: Hover) => void }) {
  const update = (e: L.LeafletMouseEvent) => {
    const v = valueAt(values, gridLat, gridLon, e.latlng.lat, e.latlng.lng);
    if (v == null || !Number.isFinite(v)) return onHover(null);
    onHover({ x: e.containerPoint.x, y: e.containerPoint.y, v });
  };
  useMapEvents({ mousemove: update, click: update, mouseout: () => onHover(null), dragstart: () => onHover(null) });
  return null;
}

interface Props {
  values: number[];
  gridLat: number[];
  gridLon: number[];
  mode: "rain" | "snow";
  hours: number;
  sourceLabel: string;
  dataLabel?: string;
  forecast?: boolean;
  updatedLabel?: string;
  stations?: { id: string; name: string; lat: number; lon: number; value: number; own?: boolean }[];
}

function stationIcon(name: string, value: number, unit: string, own = false) {
  void own;
  const bg = "#0f172a";
  const v = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:auto">
      <div title="${name}" style="background:#fff;color:${bg};font:600 11px/1.2 system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;border:1px solid rgba(15,23,42,.15);box-shadow:0 1px 3px rgba(0,0,0,.25)">${v}&nbsp;${unit}</div>
      <div style="width:6px;height:6px;border-radius:50%;background:${bg};border:1.5px solid #fff;margin-top:2px"></div>
    </div>`,
  });
}

function PrecipAccumMapInner({ values, gridLat, gridLon, mode, hours, sourceLabel, updatedLabel, dataLabel = "eigene Stationen, MeteoSchweiz", forecast = false, stations = [] }: Props) {
  const classes = mode === "snow" ? SNOW_CLASSES : ACCUM_CLASSES;
  const unit = mode === "snow" ? "cm" : "mm";
  const accum = useMemo(() => {
    let maxMm = 0;
    for (const v of values) if (v > maxMm) maxMm = v;
    return { values, maxMm, hasData: values.some(v => Number.isFinite(v) && v >= 0), incomplete: values.some(v => !Number.isFinite(v) || v < 0) };
  }, [values]);

  const [showStations, setShowStations] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const [overlay, setOverlay] = useState<{
    url: string;
    bounds: [[number, number], [number, number]];
  } | null>(null);

  useEffect(() => {
    setHover(null);
    setOverlay(renderHeatmapDataUrl(accum.values, gridLat, gridLon, classes));
  }, [accum, gridLat, gridLon, classes]);

  let pxOver1 = 0;
  for (let i = 0; i < accum.values.length; i++) if (accum.values[i] >= (mode === "snow" ? 0.5 : 1)) pxOver1++;
  const pctWet = ((pxOver1 / accum.values.length) * 100).toFixed(0);

  const mapKeyRef = useRef(`map-${Math.random()}`);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Card ref={cardRef} className="overflow-hidden border-border shadow-sm bg-card">
      <div className={`flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-border/60 ${forecast ? "sums-model-header" : "bg-card"}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground tabular-nums shadow-sm">
            {forecast ? <ChartNoAxesCombined className="size-3.5" /> : <History className="size-3.5" />}
            {forecast ? `+${hours} h Modell` : `${hours} h Rückblick`}
          </span>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            {forecast ? (mode === "snow" ? "Erwarteter Neuschnee" : "Erwarteter Niederschlag") : mode === "snow" ? "Gefallener Neuschnee" : "Gefallener Niederschlag"}
          </h2>
        </div>
        <p className="text-xs text-zinc-500 tabular-nums">
          {accum.hasData ? <>Max <span className="font-semibold text-zinc-800">{accum.maxMm.toFixed(1)} {unit}</span> · {pctWet}% der Fläche ≥ {mode === "snow" ? "0.5 cm" : "1 mm"}</> : "Mengen derzeit nicht verfügbar"}
        </p>
      </div>
      {mode === "snow" && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/60">
          <Snowflake className="size-3.5 shrink-0 text-accent" />
          {!accum.hasData ? "Neuschneedaten derzeit nicht verfügbar" : accum.incomplete ? "Modellierter Neuschnee · Daten teilweise unvollständig" : accum.maxMm === 0 ? "Kein modellierter Neuschnee im dargestellten Gebiet" : forecast ? "Neuschnee aus Modellberechnung · schneefreie Orte: 0.0 cm" : "Fläche: Modellberechnung ICON-CH1/CH2 · Stationen: gemessene Schneehöhen-Zunahme (MeteoSchweiz)"}
        </div>
      )}
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
            attributionControl={false}
            style={{ height: "100%", width: "100%", background: "#ebefeb" }}
            className="mch-precip-sums"
          >
            <ForeignReliefLayers />
            <SnowMapFraming mode={mode} />
            <TileLayer
              url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.9}
              crossOrigin="anonymous"
              attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · MeteoSchweiz'
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
                opacity={0.8}
                zIndex={460}
                className="precip-accum-overlay"
              />
            )}
            <CityMarkers />
            {showStations && stations.map((s) => (
              <Marker key={`${s.id}-${mode}-${hours}`} position={[s.lat, s.lon]} icon={stationIcon(s.name, s.value, unit, s.own)} zIndexOffset={1000}>
                <Tooltip direction="top" offset={[0, -24]}>{`${s.name} (${s.own ? "eigene Station" : "Station MeteoSchweiz"})`}</Tooltip>
              </Marker>
            ))}
            <HoverProbe values={accum.values} gridLat={gridLat} gridLon={gridLon} onHover={setHover} />
            <DockZoomControl />
          </MapContainer>

          {hover && (() => {
            const c = classes[classIndexForAccum(hover.v, classes)];
            const txt = hover.v >= 10 ? hover.v.toFixed(0) : hover.v.toFixed(1);
            return (
              <div
                role="status"
                className="pointer-events-none absolute z-[600] flex items-center gap-1.5 whitespace-nowrap rounded-md bg-card/95 px-2.5 py-1 text-xs font-semibold tabular-nums text-card-foreground shadow-md ring-1 ring-border backdrop-blur-md"
                style={{ left: Math.max(48, Math.min((cardRef.current?.clientWidth ?? 320) - 48, hover.x)), top: Math.max(40, hover.y), transform: "translate(-50%, calc(-100% - 12px))" }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-muted" style={c ? { background: `rgb(${c.rgb.join(",")})` } : undefined} />
                {txt} {unit}
              </div>
            );
          })()}

          {stations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStations((v) => !v)}
              aria-pressed={showStations}
              className={`absolute left-3 top-3 z-[500] rounded-md px-3 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-md transition-colors ${
                showStations ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-card/90 text-foreground hover:bg-card"
              }`}
            >
              <MapPin />Stationen
            </Button>
          )}

          {/* Schlanker Legenden-Streifen (Radar-Stil) */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-[500] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow-md ring-1 ring-black/5 backdrop-blur-md">
            <div className="w-52 sm:w-64">
              <div
                className="h-2 rounded-full"
                style={{ backgroundImage: `linear-gradient(to right, ${classes.map((c, i) => `rgb(${c.rgb.join(",")}) ${(i * 100) / classes.length}% ${((i + 1) * 100) / classes.length}%`).join(", ")})` }}
              />
              <div className="relative mt-0.5 h-3">
                {classes.map((c, i) => (
                  <span
                    key={c.min}
                    className={`absolute top-0 text-[9px] tabular-nums text-neutral-500 ${i === 0 ? "" : "-translate-x-1/2"}`}
                    style={{ left: `${(i * 100) / classes.length}%` }}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[9px] font-semibold text-neutral-500">{unit}</span>
          </div>
        </div>
        <SourceFooter updated={updatedLabel} map data={dataLabel}>
          {sourceLabel ? ` · ${sourceLabel}` : null}
        </SourceFooter>
      </CardContent>
    </Card>
  );
}


/** Öffentliche Variante mit Fehler-Auffangbereich (keine weisse Seite). */
export const PrecipAccumMap = withErrorBoundary(PrecipAccumMapInner, "Die Niederschlagssumme", 360);
