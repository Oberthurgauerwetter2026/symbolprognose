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
import thurgauData from "@/data/thurgau.json";
import {
  HAZARDS,
  LEVELS,
  REGIONS,
  getHazard,
  regionName,
  slugifyRegion,
  formatRange,
  type HazardId,
} from "@/lib/warnings-config";
import { listWarnings, type WarningDTO } from "@/lib/warnings.functions";
import { PushOptIn } from "@/components/warnings/push-opt-in";

const REGION_FC = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;
const THURGAU = thurgauData as unknown as FeatureCollection;

/* --------------------------- Geometrie-Hilfen -------------------------- */

function ringsOf(f: Feature): number[][][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates[0]];
  if (g.type === "MultiPolygon") return g.coordinates.map((p) => p[0]);
  return [];
}

/** Flächengewichteter Schwerpunkt (grösster Ring) für die Beschriftung. */
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
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f2 = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    area += f2;
    cx += (best[j][0] + best[i][0]) * f2;
    cy += (best[j][1] + best[i][1]) * f2;
  }
  area *= 0.5;
  if (!area) return [best[0]?.[1] ?? 47.55, best[0]?.[0] ?? 9.3];
  return [cy / (6 * area), cx / (6 * area)];
}

const REGION_META = REGION_FC.features.map((f) => {
  const name = String((f.properties as { name?: string } | null)?.name ?? "");
  return { id: slugifyRegion(name), name, feature: f, center: labelPoint(f) };
});

const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  for (const f of REGION_FC.features) holes.push(...ringsOf(f));
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
})();

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
  const color = level > 0 ? "#20242b" : "#33404d";
  const weight = level > 0 ? 700 : 500;
  return L.divIcon({
    className: "warn-label",
    html: `<div style="pointer-events:none;transform:translate(-50%,-50%);font:${weight} 11px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${color};text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;text-align:center">${name}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export interface WarnMapProps {
  /** Kompakter Modus für Embeds (kein Push-Bereich, schmalere Paddings). */
  bare?: boolean;
  className?: string;
}

export function WarnMap({ bare = false, className }: WarnMapProps) {
  const [hazard, setHazard] = useState<HazardId | "alle">("alle");
  const [selected, setSelected] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const geoRef = useRef<L.GeoJSON | null>(null);
  /** Immer aktuelle Stilfunktion für die Leaflet-Handler (sonst veralteter Closure-Stand). */
  const styleRef = useRef<(f: Feature) => L.PathOptions>(() => ({}));

  const query = useQuery({
    queryKey: ["warnings"],
    queryFn: () => listWarnings(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const warnings: WarningDTO[] = query.data?.warnings ?? [];

  /** Höchste Stufe je Gemeinde für die aktuelle Auswahl. */
  const levelByRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) {
      if (hazard !== "alle" && w.hazard !== hazard) continue;
      for (const r of w.regionIds) map.set(r, Math.max(map.get(r) ?? 0, w.level));
    }
    return map;
  }, [warnings, hazard]);

  /** Höchste Stufe je Gefahrenart (für das Banner). */
  const levelByHazard = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of warnings) map.set(w.hazard, Math.max(map.get(w.hazard) ?? 0, w.level));
    return map;
  }, [warnings]);

  const maxLevel = useMemo(
    () => Math.max(0, ...Array.from(levelByRegion.values())),
    [levelByRegion],
  );

  const selectedWarnings = useMemo(() => {
    if (!selected) return warnings.filter((w) => hazard === "alle" || w.hazard === hazard);
    return warnings.filter(
      (w) => w.regionIds.includes(selected) && (hazard === "alle" || w.hazard === hazard),
    );
  }, [warnings, selected, hazard]);

  useEffect(() => {
    const layer = geoRef.current;
    if (!layer) return;
    layer.setStyle((feature) => styleFor(feature as Feature));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelByRegion, selected]);

  function styleFor(feature: Feature): L.PathOptions {
    const id = slugifyRegion(String((feature.properties as { name?: string } | null)?.name ?? ""));
    const lvl = levelByRegion.get(id) ?? 0;
    const def = LEVELS[(lvl as 0 | 1 | 2 | 3) ?? 0];
    const isSel = selected === id;
    return {
      color: isSel ? "#1f2937" : "#4b5563",
      weight: isSel ? 2.4 : 1,
      opacity: isSel ? 1 : 0.75,
      fillColor: def.color,
      fillOpacity: def.fillOpacity,
    };
  }

  styleRef.current = styleFor;

  return (
    <div className={cn("@container space-y-3", className)}>
      {/* Banner mit Gefahrenarten */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-sm sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={() => setHazard("alle")}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition",
            hazard === "alle" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          Alle
        </button>
        {HAZARDS.map((h) => {
          const lvl = levelByHazard.get(h.id) ?? 0;
          const Icon = h.icon;
          const on = hazard === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setHazard(h.id)}
              title={h.label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition",
                on ? "border-foreground" : "border-transparent hover:bg-muted/60",
              )}
              style={
                lvl > 0
                  ? { background: LEVELS[lvl as 1 | 2 | 3].color, color: LEVELS[lvl as 1 | 2 | 3].textOnColor }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden @sm:inline">{h.label}</span>
              {lvl > 0 && <span className="rounded bg-black/15 px-1 text-[10px] font-bold">{lvl}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-2 pr-1 text-xs text-muted-foreground">
          {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {maxLevel === 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LEVELS[0].color }} />
              Keine Warnungen aktiv
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Höchste Stufe {maxLevel}
            </span>
          )}
        </div>
      </div>

      <div className={cn("grid gap-3", bare ? "grid-cols-1" : "@3xl:grid-cols-[1fr_320px]")}>
        <div className="relative h-[380px] overflow-hidden rounded-2xl shadow-lg sm:h-[520px] lg:h-[560px]">
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
              opacity={0.6}
              attribution='Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
            />
            <GeoJSON
              data={OUTSIDE_MASK}
              style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.35 })}
              interactive={false}
            />
            <GeoJSON
              data={LAKE}
              style={() => ({ color: "#5ba8c8", weight: 1, fillColor: "#7ec8e3", fillOpacity: 0.3 })}
              interactive={false}
            />
            <GeoJSON
              data={THURGAU}
              style={() => ({ color: "#1f4d80", weight: 1, opacity: 0.35, fill: false })}
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
                layer.on("click", () => setSelected((cur) => (cur === id ? null : id)));
                layer.on("mouseover", () =>
                  (layer as L.Path).setStyle({ weight: 2.4, color: "#1f2937" }),
                );
                layer.on("mouseout", () =>
                  (layer as L.Path).setStyle(styleRef.current(feature as Feature)),
                );
              }}
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
                {[0, 1, 2, 3].map((l) => (
                  <div key={l} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-5 shrink-0 rounded-sm"
                      style={{ background: LEVELS[l as 0 | 1 | 2 | 3].color }}
                    />
                    <span className="text-muted-foreground">
                      {LEVELS[l as 0 | 1 | 2 | 3].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLegendOpen(true)}
              className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 rounded-lg bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-lg hover:bg-card"
            >
              <Info className="h-4 w-4" /> Legende
            </button>
          )}
        </div>

        {/* Info-Panel */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              {selected ? regionName(selected) : "Region Oberthurgau"}
            </h2>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-0.5 text-[11px] text-muted-foreground underline"
              >
                Auswahl aufheben
              </button>
            )}
            {query.data?.warning && (
              <p className="mt-2 text-xs text-muted-foreground">{query.data.warning}</p>
            )}
            {selectedWarnings.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Zurzeit keine Warnungen{selected ? " für diese Gemeinde" : ""}. Es besteht keine
                besondere Gefahr.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {selectedWarnings.map((w) => {
                  const h = getHazard(w.hazard as HazardId);
                  const Icon = h.icon;
                  const def = LEVELS[w.level as 1 | 2 | 3];
                  return (
                    <li key={w.id} className="rounded-lg border border-border p-2.5">
                      <div
                        className="-m-2.5 mb-2 flex items-center gap-2 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold"
                        style={{ background: def.color, color: def.textOnColor }}
                      >
                        <Icon className="h-4 w-4" />
                        {w.title || `${h.title} (Stufe ${w.level})`}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRange(w.validFrom, w.validTo)}
                      </p>
                      <p className="mt-1.5 text-xs text-foreground">{w.description}</p>
                      {w.impact && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Mögliche Auswirkungen: </span>
                          {w.impact}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {w.regionIds.length === REGIONS.length
                          ? "Ganze Region"
                          : w.regionIds.map((r) => regionName(r)).join(", ")}
                        {w.source === "auto" ? " · automatisch (Radar)" : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!bare && (
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BellRing className="h-4 w-4" /> Warnungen abonnieren
              </h3>
              <PushOptIn defaultRegionId={selected} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
