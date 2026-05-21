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
import { fetchForecast } from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Spot = { id: string; name: string; lat: number; lon: number };

const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4986, lon: 9.4470 },
  { id: "amriswil", name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { id: "sitterdorf", name: "Sitterdorf", lat: 47.5028, lon: 9.2336 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
];

const REGION = regionData as unknown as FeatureCollection;
const LAKE = lakeData as unknown as FeatureCollection;

// Aussen-Maske: Welt-Polygon mit allen Region-Aussenringen als Löcher.
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

const HOUR_STEPS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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
  temp,
  tMin,
  tMax,
  code,
}: {
  name: string;
  temp: number;
  tMin: number;
  tMax: number;
  code: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px 8px 8px",
        borderRadius: 999,
        background: "#1f4a7a",
        boxShadow: "0 6px 18px rgba(0,0,0,0.30)",
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#fff",
        lineHeight: 1.05,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WeatherIcon code={code} size={32} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.01em" }}>
          {name}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            {Math.round(temp)}°
          </span>
          <span
            style={{
              background: "#bcd8ec",
              color: "#1f4a7a",
              padding: "2px 7px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {Math.round(tMin)}°
          </span>
          <span
            style={{
              background: "#0c2b52",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 5,
              fontSize: 11,
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
  hourStep,
}: {
  spot: Spot;
  dayIndex: number;
  hourStep: number;
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
              background: "#1f4a7a",
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
    const day = data.daily.time[dayIndex] ?? data.daily.time[0];
    const targetHour = HOUR_STEPS[hourStep] ?? 12;
    const prefix = `${day}T${pad2(targetHour)}`;
    let i = data.hourly.time.findIndex((t) => t.startsWith(prefix));
    if (i === -1) {
      // Fallback: nächstgelegene Stunde am gewählten Tag
      i = data.hourly.time.findIndex((t) => t.startsWith(`${day}T`));
      if (i === -1) i = 0;
    }
    const temp = data.hourly.temperature_2m[i] ?? 0;
    const code = data.hourly.weathercode[i] ?? 0;
    const html = renderToStaticMarkup(
      <MarkerPill
        name={spot.name}
        temp={temp}
        tMin={data.daily.temperature_2m_min[dayIndex] ?? 0}
        tMax={data.daily.temperature_2m_max[dayIndex] ?? 0}
        code={code}
      />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [180, 64],
      iconAnchor: [90, 32],
    });
  }, [data, dayIndex, hourStep, spot]);

  return <Marker position={[spot.lat, spot.lon]} icon={icon} />;
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [dayIndex, setDayIndex] = useState(0);
  const [hourStep, setHourStep] = useState(() => {
    const h = new Date().getHours();
    return Math.min(HOUR_STEPS.length - 1, Math.round(h / 3));
  });

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
    // Nördlich erweitern, damit der Bodensee mit ins Bild kommt
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const extended = L.latLngBounds(
      [sw.lat, sw.lng],
      [ne.lat + 0.015, ne.lng],
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
      {/* Tages-Tabs */}
      <div className="flex flex-wrap gap-2">
        {days.map((d, i) => {
          const { top, sub } = formatDayLabel(d, i);
          const active = i === dayIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setDayIndex(i)}
              className={cn(
                "flex flex-1 min-w-[80px] flex-col items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <span className="font-semibold">{top}</span>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
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
          boundsOptions={{ padding: [12, 12] }}
          maxBounds={maxBounds}
          maxBoundsViscosity={1.0}
          minZoom={12}
          maxZoom={14}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%", background: "#e8edef" }}
        >
          {/* Relief-Schummerung (innen + aussen) */}
          <TileLayer
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />
          {/* Aussen-Maske: gedämpftes Grau */}
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#cfd6d9",
              fillOpacity: 0.55,
            })}
            interactive={false}
          />
          {/* Region innen: transparentes Grün, Relief scheint durch */}
          <GeoJSON
            data={REGION}
            style={() => ({
              color: "#ffffff",
              weight: 1.5,
              opacity: 0.7,
              fillColor: "#a8cf95",
              fillOpacity: 0.55,
            })}
            interactive={false}
          />
          {/* Bodensee */}
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
              hourStep={hourStep}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>
      </div>

      {/* Stunden-Slider */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Uhrzeit
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground tabular-nums">
            {pad2(HOUR_STEPS[hourStep])}:00
          </span>
        </div>
        <Slider
          value={[hourStep]}
          min={0}
          max={HOUR_STEPS.length - 1}
          step={1}
          onValueChange={(v) => setHourStep(v[0] ?? 0)}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
          {HOUR_STEPS.map((h) => (
            <span key={h}>{pad2(h)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
