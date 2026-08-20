import { withErrorBoundary } from "@/components/app-error-boundary";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, GeoJSON, TileLayer, ZoomControl, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Loader2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import switzerlandData from "@/data/switzerland.json";
import thurgauData from "@/data/thurgau.json";
import {
  HAZARDS,
  LEVELS,
  getHazard,
  regionName,
  slugifyRegion,
  formatRange,
  type HazardId,
} from "@/lib/warnings-config";
import { type WarningDTO } from "@/lib/warnings.functions";
import { warningsQuery } from "@/lib/map-queries";
import { PushOptIn } from "@/components/warnings/push-opt-in";
import { useWarningsRealtime } from "@/hooks/use-warnings";

const REGION_FC = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;
const SWITZERLAND = switzerlandData as unknown as FeatureCollection;

/* --------------------------- Geometrie-Hilfen -------------------------- */

function ringsOf(f: Feature): number[][][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates[0]];
  if (g.type === "MultiPolygon") return g.coordinates.map((p) => p[0]);
  return [];
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Kürzeste Distanz eines Punktes zum Polygonrand. */
function distToRing(x: number, y: number, ring: number[][]): number {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0];
    const ay = ring[j][1];
    const bx = ring[i][0];
    const by = ring[i][1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    min = Math.min(min, Math.hypot(x - px, y - py));
  }
  return min;
}

/**
 * Punkt maximaler Randdistanz („Pole of Inaccessibility“) im grössten Ring –
 * liegt im Gegensatz zum Schwerpunkt immer sichtbar innerhalb der Fläche.
 */
function labelPoint(f: Feature): [number, number] {
  const rings = ringsOf(f);
  let best: number[][] = [];
  let bestArea = -1;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    }
    a = Math.abs(a / 2);
    if (a > bestArea) {
      bestArea = a;
      best = r;
    }
  }
  if (!best.length) return [47.55, 9.3];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of best) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  let bx = (minX + maxX) / 2;
  let by = (minY + maxY) / 2;
  let bestScore = -Infinity;
  let stepX = (maxX - minX) / 24;
  let stepY = (maxY - minY) / 24;
  let x0 = minX;
  let y0 = minY;
  let x1 = maxX;
  let y1 = maxY;

  for (let pass = 0; pass < 3; pass++) {
    for (let x = x0; x <= x1; x += stepX) {
      for (let y = y0; y <= y1; y += stepY) {
        if (!pointInRing(x, y, best)) continue;
        const d = distToRing(x, y, best);
        if (d > bestScore) {
          bestScore = d;
          bx = x;
          by = y;
        }
      }
    }
    x0 = bx - stepX;
    x1 = bx + stepX;
    y0 = by - stepY;
    y1 = by + stepY;
    stepX /= 8;
    stepY /= 8;
  }
  return [by, bx];
}


const REGION_META = REGION_FC.features.map((f) => {
  const name = String((f.properties as { name?: string } | null)?.name ?? "");
  return { id: slugifyRegion(name), name, feature: f, center: labelPoint(f) };
});

function maskOf(sources: FeatureCollection[]): FeatureCollection {
  const holes: number[][][] = [];
  for (const fc of sources) {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon" && g.coordinates[0]) holes.push(g.coordinates[0]);
      else if (g.type === "MultiPolygon")
        for (const p of g.coordinates) if (p[0]) holes.push(p[0]);
    }
  }
  const world: number[][] = [
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
}

const OUTSIDE_MASK: FeatureCollection = maskOf([REGION_FC, LAKE]);
const OUTSIDE_CH_MASK: FeatureCollection = maskOf([SWITZERLAND, LAKE]);

const REGION_OUTLINE: FeatureCollection = {
  type: "FeatureCollection",
  features: REGION_FC.features.map((f) => ({
    type: "Feature" as const,
    properties: {},
    geometry: f.geometry,
  })),
};


const REGION_BOUNDS: L.LatLngBoundsExpression = (() => {
  const b = L.geoJSON(REGION_FC).getBounds();
  return [
    [b.getSouth(), b.getWest()],
    [b.getNorth(), b.getEast()],
  ];
})();

/* ------------------------------ Karte ---------------------------------- */

function FitRegion() {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(REGION_BOUNDS, { padding: [16, 16], animate: false });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [map]);
  return null;
}

function labelIcon(name: string, level: number): L.DivIcon {
  const color = level > 0 ? "#14181f" : "#2a3540";
  const weight = level > 0 ? 800 : 600;
  const size = level > 0 ? 10 : 9;
  return L.divIcon({
    className: "warn-label",
    html: `<div style="pointer-events:none;position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:max-content;font:${weight} ${size}px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${color};text-shadow:0 0 1px #fff,0 0 2px #fff,0 0 3px #fff,0 1px 1px #fff;white-space:nowrap;text-align:center;letter-spacing:0.01em">${name}</div>`,

    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}


export interface WarnMapProps {
  /** Kompakter Modus für Embeds (kein Push-Bereich, schmalere Paddings). */
  bare?: boolean;
  /** Widget-Modus: nur Karte und aktive Warnungen, ohne Filter und Push. */
  snapshot?: boolean;
  className?: string;
}

function WarnMapInner({ bare = false, snapshot = false, className }: WarnMapProps) {
  const [hazard, setHazard] = useState<HazardId | "alle">("alle");
  const [selected, setSelected] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const geoRef = useRef<L.GeoJSON | null>(null);
  /** Immer aktuelle Stilfunktion für die Leaflet-Handler (sonst veralteter Closure-Stand). */
  const styleRef = useRef<(f: Feature) => L.PathOptions>(() => ({}));
  const hoverRef = useRef<(f: Feature) => L.PathOptions>(() => ({}));


  const query = useQuery({
    ...warningsQuery(),
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  /** Live-Aktualisierung: Änderungen an Warnungen sofort übernehmen. */
  useWarningsRealtime();


  const warnings: WarningDTO[] = query.data?.warnings ?? [];

  /** Zeitpunkt des letzten erfolgreichen Datenabrufs (Europe/Zurich). */
  const updatedLabel = useMemo(() => {
    const iso = query.data?.updatedAt;
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(d);
  }, [query.data?.updatedAt]);


  /** Höchste Stufe je Gemeinde für die aktuelle Auswahl (echte Warnungen). */
  const levelByRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) {
      if (hazard !== "alle" && w.hazard !== hazard) continue;
      if (w.advisory) continue;
      for (const r of w.regionIds) map.set(r, Math.max(map.get(r) ?? 0, w.level));
    }
    return map;
  }, [warnings, hazard]);

  /** Höchste Stufe je Gemeinde aus Vorinformationen (schraffiert). */
  const advisoryByRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) {
      if (hazard !== "alle" && w.hazard !== hazard) continue;
      if (!w.advisory) continue;
      for (const r of w.regionIds) map.set(r, Math.max(map.get(r) ?? 0, w.level));
    }
    return map;
  }, [warnings, hazard]);


  /** Höchste Stufe je Gefahrenart (nur echte Warnungen, für die Chips). */
  const levelByHazard = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) {
      if (w.advisory) continue;
      map.set(w.hazard, Math.max(map.get(w.hazard) ?? 0, w.level));
    }
    return map;
  }, [warnings]);

  /** Höchste Stufe je Gefahrenart aus Vorinformationen. */
  const advisoryByHazard = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) {
      if (!w.advisory) continue;
      map.set(w.hazard, Math.max(map.get(w.hazard) ?? 0, w.level));
    }
    return map;
  }, [warnings]);

  const maxLevel = useMemo(
    () => Math.max(0, ...Array.from(levelByRegion.values())),
    [levelByRegion],
  );

  const selectedWarnings = useMemo(() => {
    // Ohne Auswahl zeigt das Panel die Legende statt einer Warnliste.
    if (!selected) return [];
    return warnings.filter(
      (w) => w.regionIds.includes(selected) && (hazard === "alle" || w.hazard === hazard),
    );
  }, [warnings, selected, hazard]);


  useEffect(() => {
    const layer = geoRef.current;
    if (!layer) return;
    layer.setStyle((feature) => styleFor(feature as Feature));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelByRegion, advisoryByRegion, selected]);

  function styleFor(feature: Feature): L.PathOptions {
    const id = slugifyRegion(String((feature.properties as { name?: string } | null)?.name ?? ""));
    const lvl = levelByRegion.get(id) ?? 0;
    const adv = lvl > 0 ? 0 : (advisoryByRegion.get(id) ?? 0);
    const def = LEVELS[(lvl as 0 | 1 | 2 | 3) ?? 0];
    const isSel = selected === id;
    if (adv > 0) {
      // Vorinformation: schraffiert in der Stufenfarbe.
      return {
        color: isSel ? "#2561a1" : "#4b5563",
        weight: isSel ? 3 : 1,
        opacity: isSel ? 1 : 0.75,
        fillColor: `url(#warn-hatch-${adv})`,
        fillOpacity: 1,
      };
    }
    return {
      color: isSel ? "#2561a1" : "#4b5563",
      weight: isSel ? 3 : 1,
      opacity: isSel ? 1 : 0.75,
      fillColor: def.color,
      fillOpacity: isSel ? Math.min(0.85, def.fillOpacity + 0.08) : def.fillOpacity,
    };

  }


  /** Farbe leicht Richtung Schwarz mischen. */
  function darken(hex: string, amount = 0.18): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 255) * (1 - amount));
    const g = Math.round(((n >> 8) & 255) * (1 - amount));
    const b = Math.round((n & 255) * (1 - amount));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  /** Leichte Abdunklung beim Überfahren/Antippen – Warnfarbe bleibt erhalten. */
  function hoverStyleFor(feature: Feature): L.PathOptions {
    const b = styleFor(feature);
    return {
      ...b,
      color: b.color ?? "#1f2937",
      weight: Math.max(2, Number(b.weight ?? 1)),
      opacity: 1,
      fillColor: darken(String(b.fillColor ?? "#94a3b8"), 0.1),
      fillOpacity: Math.min(0.9, (b.fillOpacity ?? 0.3) + 0.1),
    };

  }



  styleRef.current = styleFor;
  hoverRef.current = hoverStyleFor;


  return (
    <div className={cn("@container space-y-3", className)}>
      {/* Banner mit Gefahrenarten */}
      {!snapshot && (
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={() => {
            setHazard("alle");
            setSelected(null);
          }}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
            hazard === "alle" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          Alle
        </button>
        {HAZARDS.map((h) => {
          const lvl = levelByHazard.get(h.id) ?? 0;
          const adv = advisoryByHazard.get(h.id) ?? 0;
          const shown = Math.max(lvl, adv) as 0 | 1 | 2 | 3;
          const isAdvisory = lvl === 0 && adv > 0;
          const Icon = h.icon;
          const on = hazard === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setHazard(h.id);
                setSelected(null);
              }}
              title={isAdvisory ? `${h.label} – Vorinformation` : h.label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition",
                on ? "border-foreground" : "border-transparent hover:bg-muted/60",
              )}
              style={
                shown > 0
                  ? {
                      background: isAdvisory
                        ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 3px, transparent 3px 6px), ${LEVELS[shown as 1 | 2 | 3].color}`
                        : LEVELS[shown as 1 | 2 | 3].color,
                      color: LEVELS[shown as 1 | 2 | 3].textOnColor,
                    }
                  : undefined
              }
            >
              <Icon className="h-5 w-5 @sm:h-6 @sm:w-6" />
              <span className="hidden @sm:inline">{h.label}</span>
              {shown > 0 && <span className="rounded bg-black/15 px-1.5 text-xs font-bold">{shown}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-2 pr-1 text-[13px] text-muted-foreground">
          {query.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
          {maxLevel === 0 ? (
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: LEVELS[0].color }} />
              Keine Warnungen aktiv
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4" />
              Höchste Stufe {maxLevel}
            </span>
          )}
        </div>
      </div>
      )}


      <div
        className={cn(
          "grid gap-3",
          bare
            ? "grid-cols-1 @lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]"
            : "@lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]",
        )}
      >
        <div
          className={cn(
            "map-attrib-compact relative h-[340px] w-full overflow-hidden rounded-2xl shadow-lg",
            bare ? "@md:h-[600px] @lg:h-[600px]" : "sm:h-[600px] @lg:h-[600px]",

          )}
        >
          {/* Schraffur-Muster für Vorinformationen (referenziert via fill="url(#…)") */}
          <svg width="0" height="0" aria-hidden="true" className="absolute">
            <defs>
              {[1, 2, 3].map((l) => (
                <pattern
                  key={l}
                  id={`warn-hatch-${l}`}
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="8" height="8" fill={LEVELS[l as 1 | 2 | 3].color} opacity="0.18" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke={LEVELS[l as 1 | 2 | 3].color}
                    strokeWidth="4"
                    opacity="0.95"
                  />
                </pattern>
              ))}
            </defs>
          </svg>


          <MapContainer
            center={[47.555, 9.3]}
            zoom={11}
            zoomSnap={0.25}
            zoomDelta={0.5}
            minZoom={9}
            maxZoom={15}
            scrollWheelZoom
            zoomControl={false}
            attributionControl
            style={{ height: "100%", width: "100%", background: "#ebefeb" }}
          >
            <FitRegion />
            <TileLayer
              url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.55}
              attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
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
              ref={(r) => {
                geoRef.current = r;
              }}
              data={REGION_FC}
              style={(f) => styleFor(f as Feature)}
              onEachFeature={(feature, layer) => {
                const name = String((feature.properties as { name?: string } | null)?.name ?? "");
                const id = slugifyRegion(name);
                const path = layer as L.Path;
                const enter = () => path.setStyle(hoverRef.current(feature as Feature));
                const leave = () => path.setStyle(styleRef.current(feature as Feature));
                layer.on("click", () => setSelected((cur) => (cur === id ? null : id)));
                layer.on("mouseover", enter);
                layer.on("mouseout", leave);
                layer.on("touchstart" as any, enter);
                layer.on("touchend" as any, leave);
              }}

            />
            <GeoJSON
              data={REGION_OUTLINE}
              style={() => ({ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false })}
              interactive={false}
            />
            {REGION_META.map((r) => (
              <Marker
                key={r.id}
                position={r.center}
                icon={labelIcon(r.name, levelByRegion.get(r.id) ?? 0)}
                interactive={false}
                keyboard={false}
              />
            ))}
            <ZoomControl position="topright" />
          </MapContainer>

          {/* Legende – nur auf Klick */}
          {legendOpen ? (
            <div className="absolute bottom-3 left-3 z-[400] w-[210px] rounded-lg bg-card/95 p-3 text-xs shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">Legende</span>
                <button
                  type="button"
                  aria-label="Legende schliessen"
                  onClick={() => setLegendOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {[0].map((l) => (
                  <div key={l} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-5 shrink-0 rounded-sm"
                      style={{ background: LEVELS[l as 0].color }}
                    />
                    <span className="text-muted-foreground">
                      {LEVELS[l as 0].label}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-5 shrink-0 rounded-sm"
                    style={{
                      background: `repeating-linear-gradient(45deg, ${LEVELS[1].color} 0 3px, transparent 3px 6px)`,
                    }}
                  />
                  <span className="text-muted-foreground">Vorinformation</span>
                </div>
                {[1, 2, 3].map((l) => (
                  <div key={l} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-5 shrink-0 rounded-sm"
                      style={{ background: LEVELS[l as 1 | 2 | 3].color }}
                    />
                    <span className="text-muted-foreground">
                      {LEVELS[l as 1 | 2 | 3].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLegendOpen(true)}
              aria-label="Legende anzeigen"
              title="Legende"
              className="absolute bottom-3 left-3 z-[400] flex h-8 w-8 items-center justify-center rounded-full bg-card/50 text-foreground/70 shadow-md transition hover:bg-card hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Info-Panel */}

        <aside
          className={cn(
            "space-y-3",
            "@lg:flex @lg:h-[600px] @lg:flex-col",


          )}
        >
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm",
              bare ? "@lg:flex-1" : "@lg:flex-1",
            )}
          >

            {selected && (
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {regionName(selected)}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Auswahl schliessen"
                  className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            {query.data?.warning && (
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{query.data.warning}</p>
            )}
            <div
              className={cn(
                "overflow-y-auto pr-1",
                bare ? "@lg:min-h-0 @lg:flex-1" : "@lg:min-h-0 @lg:flex-1",
              )}
            >

              {snapshot && !selected ? (
                warnings.length === 0 ? (
                  <p className="mt-3 text-base leading-relaxed text-foreground">
                    Zurzeit keine Warnungen im Oberthurgau.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {/* Widget: pro Gefahrenart/Stufe nur eine Zeile (die Automatik
                        legt je Gemeinde eine eigene Warnung an). */}
                    {Array.from(
                      new Map(
                        warnings.map((w) => [`${w.hazard}-${w.level}-${w.advisory ? 1 : 0}`, w]),
                      ).values(),
                    ).map((w) => {
                      const h = HAZARDS.find((x) => x.id === w.hazard);
                      const Icon = h?.icon;
                      const lv = LEVELS[w.level as 1 | 2 | 3];
                      return (
                        <li
                          key={w.id}
                          className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                          style={{ background: lv.color, color: lv.textOnColor }}
                        >
                          {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" />}
                          <span className="text-sm font-semibold leading-snug">
                            {h?.label ?? w.hazard} (Stufe {w.level})
                            {w.advisory ? " · Vorinformation" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : !selected ? (
                <div className="mt-3">
                  <p className="text-base leading-relaxed text-foreground">
                    Gemeinde auf der Karte antippen, um Warnungen anzuzeigen.
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Legende</p>
                    {[0].map((l) => (
                      <div key={l} className="flex items-center gap-2 text-sm">
                        <span
                          className="inline-block h-4 w-6 shrink-0 rounded-sm border border-border"
                          style={{ background: LEVELS[l as 0].color }}
                        />
                        <span className="text-muted-foreground">
                          {LEVELS[l as 0].label}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block h-4 w-6 shrink-0 rounded-sm border border-border"
                        style={{
                          background: `repeating-linear-gradient(45deg, ${LEVELS[1].color} 0 4px, transparent 4px 8px)`,
                        }}
                      />
                      <span className="text-muted-foreground">Vorinformation</span>
                    </div>
                    {[1, 2, 3].map((l) => (
                      <div key={l} className="flex items-center gap-2 text-sm">
                        <span
                          className="inline-block h-4 w-6 shrink-0 rounded-sm border border-border"
                          style={{ background: LEVELS[l as 1 | 2 | 3].color }}
                        />
                        <span className="text-muted-foreground">
                          {LEVELS[l as 1 | 2 | 3].label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedWarnings.length === 0 ? (
                <p className="mt-3 text-base leading-relaxed text-foreground">
                  Zurzeit keine Warnungen für diese Gemeinde. Es besteht keine besondere Gefahr.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {selectedWarnings.map((w) => {
                    const h = getHazard(w.hazard as HazardId);
                    const Icon = h.icon;
                    const def = LEVELS[w.level as 1 | 2 | 3];
                    const impactRaw = w.impact ?? "";
                    const cut = impactRaw.indexOf("Empfohlenes Verhalten:");
                    const impactText = cut >= 0 ? impactRaw.slice(0, cut).trim() : impactRaw.trim();
                    const adviceText =
                      cut >= 0 ? impactRaw.slice(cut + "Empfohlenes Verhalten:".length).trim() : "";
                    return (
                      <li key={w.id} className="overflow-hidden rounded-lg border border-border">
                        <div
                          className="flex items-start gap-2 px-3 py-2 text-base font-semibold"
                          style={
                            w.advisory
                              ? {
                                  background: `color-mix(in srgb, ${def.color} 22%, transparent)`,
                                  color: "inherit",
                                  boxShadow: `inset 4px 0 0 ${def.color}`,
                                }
                              : { background: def.color, color: def.textOnColor }
                          }
                        >
                          <Icon className="h-6 w-6 shrink-0" />
                          {(() => {
                            const fallback = `${h.label} (Stufe ${w.level})`;
                            const raw = (w.title || fallback).trim();
                            const stripped = w.advisory
                              ? raw.replace(/^vorinformation\s*[:–-]?\s*/i, "").trim()
                              : raw;
                            const titleText = stripped || fallback;
                            return (
                              <div className="min-w-0 flex-1">
                                {w.advisory && (
                                  <span className="mb-1 block w-fit rounded border border-current px-1.5 py-0.5 text-[11px] font-semibold">
                                    Vorinformation
                                  </span>
                                )}
                                <span className="block truncate">{titleText}</span>
                              </div>
                            );
                          })()}


                        </div>

                        <div className="space-y-3 p-3">
                          <p className="text-base font-medium text-muted-foreground">
                            {formatRange(w.validFrom, w.validTo)}
                          </p>

                          <p className="text-base leading-relaxed text-foreground">
                            {w.advisory
                              ? (w.description ?? "").replace(/^Vorinformation\s*[:–-]?\s*/i, "").trim()
                              : w.description}
                          </p>

                          {w.peakPhase && (
                            <p className="text-base leading-relaxed text-foreground">
                              <span className="font-semibold">Stärkste Phase: </span>
                              {w.peakPhase}
                            </p>
                          )}

                          {impactText && (
                            <p className="text-base leading-relaxed text-foreground">
                              <span className="font-semibold">Mögliche Auswirkungen: </span>
                              {impactText}
                            </p>
                          )}
                          {adviceText && (
                            <p className="text-base leading-relaxed text-foreground">
                              <span className="font-semibold">Empfohlenes Verhalten: </span>
                              {adviceText}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground">
              <span>Weitere Details:</span>
              <a
                href="https://oberthurgauerwetter.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                oberthurgauerwetter.ch
              </a>
            </div>
          </div>


          {!snapshot && (
            <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <BellRing className="h-3.5 w-3.5" /> Warnungen abonnieren
              </h3>
              <PushOptIn defaultRegionId={selected} />
            </div>
          )}

        </aside>

      </div>

      <div className="text-left text-[11px] text-muted-foreground">
        {updatedLabel ? <>Aktualisiert {updatedLabel} · </> : null}
        Quelle: Oberthurgauer Wetter · Radar MCH
      </div>


    </div>
  );
}


/** Öffentliche Variante mit Fehler-Auffangbereich (keine weisse Seite). */
export const WarnMap = withErrorBoundary(WarnMapInner, "Die Warnkarte", 480);
