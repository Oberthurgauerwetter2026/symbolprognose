import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  GeoJSON,
  Marker,
  TileLayer,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
import {
  fetchForecast,
  formatTimeHHMM,
  weatherLabel,
  weekdayShort,
  windDirectionLabel,
  type ForecastResponse,
} from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Spot = { id: string; name: string; lat: number; lon: number };

const BRAND = "#2561a1";

const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4986, lon: 9.4470 },
  { id: "amriswil", name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { id: "sitterdorf", name: "Sitterdorf", lat: 47.5028, lon: 9.2336 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
  { id: "uttwil", name: "Uttwil", lat: 47.5944, lon: 9.3408 },
];

const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;

const OUTSIDE_MASK: FeatureCollection = (() => {
  const holes: number[][][] = [];
  for (const f of REGION.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      if (g.coordinates[0]) holes.push(g.coordinates[0]);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        if (poly[0]) holes.push(poly[0]);
      }
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
})();

function formatDayLabel(d: Date, offset: number): { top: string; sub: string } {
  if (offset === 0) return { top: "Heute", sub: dateSub(d) };
  if (offset === 1) return { top: "Morgen", sub: dateSub(d) };
  const wd = new Intl.DateTimeFormat("de-CH", { weekday: "short" }).format(d);
  return { top: wd.replace(".", ""), sub: dateSub(d) };
}

function dateSub(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function MarkerPill({
  name,
  tMin,
  tMax,
  code,
}: {
  name: string;
  tMin: number;
  tMax: number;
  code: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 16px 9px 9px",
        borderRadius: 999,
        background: BRAND,
        boxShadow: "0 6px 20px rgba(0,0,0,0.32)",
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#fff",
        lineHeight: 1.05,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WeatherIcon code={code} size={38} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.01em" }}>
          {name}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              background: "#cfe1f2",
              color: BRAND,
              padding: "3px 9px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {Math.round(tMin)}°
          </span>
          <span
            style={{
              background: "#0d3563",
              color: "#fff",
              padding: "3px 9px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {Math.round(tMax)}°
          </span>
        </div>
      </div>
    </div>
  );
}

function SpotMarker({
  spot,
  dayIndex,
  onClick,
}: {
  spot: Spot;
  dayIndex: number;
  onClick: (s: Spot) => void;
}) {
  const { data } = useQuery({
    queryKey: ["map-weather", spot.id],
    queryFn: () => fetchForecast(spot.lat, spot.lon),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const icon = useMemo(() => {
    if (!data) {
      return L.divIcon({
        html: renderToStaticMarkup(
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: BRAND,
              color: "#fff",
              fontFamily: '"Figtree", system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {spot.name}
          </div>,
        ),
        className: "region-map-marker",
        iconSize: [120, 28],
        iconAnchor: [60, 14],
      });
    }
    const code = data.daily.weathercode[dayIndex] ?? 0;
    const tMin = data.daily.temperature_2m_min[dayIndex] ?? 0;
    const tMax = data.daily.temperature_2m_max[dayIndex] ?? 0;
    const html = renderToStaticMarkup(
      <MarkerPill name={spot.name} tMin={tMin} tMax={tMax} code={code} />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [200, 72],
      iconAnchor: [100, 36],
    });
  }, [data, dayIndex, spot]);

  return (
    <Marker
      position={[spot.lat, spot.lon]}
      icon={icon}
      eventHandlers={{ click: () => onClick(spot) }}
    />
  );
}

function SpotDetailSheet({
  spot,
  onOpenChange,
}: {
  spot: Spot | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = spot !== null;
  const { data } = useQuery({
    queryKey: ["map-weather", spot?.id ?? "none"],
    queryFn: () => fetchForecast(spot!.lat, spot!.lon),
    enabled: open,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-2xl" style={{ color: BRAND }}>
            {spot?.name}
          </SheetTitle>
          <SheetDescription>
            6-Tagesprognose und 3-Stunden-Verlauf
          </SheetDescription>
        </SheetHeader>

        {!data ? (
          <div className="mt-8 text-sm text-muted-foreground">
            Lade Prognose …
          </div>
        ) : (
          <DetailContent data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailContent({ data }: { data: ForecastResponse }) {
  const [activeDay, setActiveDay] = useState(0);

  const days = data.daily.time.slice(0, 6);
  const activeDayIso = days[activeDay];

  const hourlyForDay = useMemo(() => {
    if (!activeDayIso) return [];
    const out: Array<{ time: string; t: number; code: number; pp: number }> =
      [];
    for (let i = 0; i < data.hourly.time.length; i++) {
      const t = data.hourly.time[i];
      if (!t.startsWith(activeDayIso)) continue;
      const hour = parseInt(t.slice(11, 13), 10);
      if (hour % 3 !== 0) continue;
      out.push({
        time: t,
        t: data.hourly.temperature_2m[i] ?? 0,
        code: data.hourly.weathercode[i] ?? 0,
        pp: data.hourly.precipitation_probability[i] ?? 0,
      });
    }
    return out;
  }, [data, activeDayIso]);

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          6 Tage
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {days.map((iso, idx) => {
            const d = new Date(iso);
            const label =
              idx === 0
                ? "Heute"
                : idx === 1
                  ? "Morgen"
                  : weekdayShort(d);
            const active = idx === activeDay;
            return (
              <li key={iso}>
                <button
                  type="button"
                  onClick={() => setActiveDay(idx)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <WeatherIcon code={data.daily.weathercode[idx] ?? 0} size={28} />
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        {dateSub(d)} ·{" "}
                        {Math.round(
                          data.daily.precipitation_probability_max[idx] ?? 0,
                        )}
                        % Regen
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-muted-foreground">
                      {Math.round(data.daily.temperature_2m_min[idx] ?? 0)}°
                    </span>
                    <span style={{ color: BRAND }}>
                      {Math.round(data.daily.temperature_2m_max[idx] ?? 0)}°
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          3-Stunden-Verlauf
        </h3>
        <div className="rounded-xl border border-border">
          <div className="grid grid-cols-[64px_1fr_60px_56px] gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Zeit</span>
            <span>Wetter</span>
            <span className="text-right">Temp</span>
            <span className="text-right">Regen</span>
          </div>
          <ul className="divide-y divide-border">
            {hourlyForDay.map((h) => (
              <li
                key={h.time}
                className="grid grid-cols-[64px_1fr_60px_56px] items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium tabular-nums">
                  {formatTimeHHMM(h.time)}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <WeatherIcon code={h.code} size={22} />
                  <span className="truncate">{weatherLabel(h.code)}</span>
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {Math.round(h.t)}°
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round(h.pp)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        Wind {Math.round(data.daily.windspeed_10m_max[activeDay] ?? 0)} km/h aus{" "}
        {windDirectionLabel(
          data.daily.winddirection_10m_dominant[activeDay] ?? 0,
        )}
        , Böen bis{" "}
        {Math.round(data.daily.windgusts_10m_max[activeDay] ?? 0)} km/h.
      </div>
    </div>
  );
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [dayIndex, setDayIndex] = useState(0);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const { bounds, maxBounds } = useMemo(() => {
    const layer = L.geoJSON(REGION);
    const b = layer.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const extended = L.latLngBounds(
      [sw.lat - 0.005, sw.lng - 0.005],
      [ne.lat + 0.015, ne.lng + 0.005],
    );
    return { bounds: extended, maxBounds: extended.pad(0.15) };
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground shadow-lg">
        Karte wird geladen …
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tages-Umschalter (Pill-Group) */}
      <div className="inline-flex w-full gap-1 rounded-full bg-muted p-1">
        {days.map((d, i) => {
          const { top, sub } = formatDayLabel(d, i);
          const active = i === dayIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setDayIndex(i)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-white shadow"
                  : "text-foreground hover:bg-foreground/5",
              )}
              style={active ? { background: BRAND } : undefined}
            >
              <span className="font-semibold leading-tight">{top}</span>
              <span
                className={cn(
                  "text-xs leading-tight",
                  active ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Karte */}
      <div className="relative h-[600px] w-full overflow-hidden rounded-2xl shadow-lg">
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [24, 24] }}
          maxBounds={maxBounds}
          maxBoundsViscosity={1.0}
          minZoom={13}
          maxZoom={15}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%", background: "#e8edef" }}
        >
          <TileLayer
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />
          {/* Aussen-Maske: dunkleres Grau */}
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#8a96a0",
              fillOpacity: 0.7,
            })}
            interactive={false}
          />
          {/* Region innen: dezenter Grün-Hauch, Relief bleibt markant */}
          <GeoJSON
            data={REGION}
            style={() => ({
              color: BRAND,
              weight: 2,
              opacity: 0.9,
              fillColor: "#b8d9a3",
              fillOpacity: 0.28,
            })}
            interactive={false}
          />
          <GeoJSON
            data={LAKE}
            style={() => ({
              color: "#6bb6d6",
              weight: 0.6,
              fillColor: "#7ec8e3",
              fillOpacity: 0.9,
            })}
            interactive={false}
          />
          {SPOTS.map((s) => (
            <SpotMarker
              key={s.id}
              spot={s}
              dayIndex={dayIndex}
              onClick={setSelectedSpot}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>
      </div>

      <SpotDetailSheet
        spot={selectedSpot}
        onOpenChange={(o) => {
          if (!o) setSelectedSpot(null);
        }}
      />
    </div>
  );
}
