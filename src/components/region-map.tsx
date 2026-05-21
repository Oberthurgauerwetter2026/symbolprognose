import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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
  const collect = (fc: FeatureCollection) => {
    for (const f of fc.features) {
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
  };
  collect(REGION);
  collect(LAKE);
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

const MARKER_PILL_CLASS = "region-map-pill";

function MarkerPill({
  name,
  tMin,
  tMax,
  code,
  isDay,
}: {
  name: string;
  tMin: number;
  tMax: number;
  code: number;
  isDay: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px 8px 8px",
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
          width: 46,
          height: 46,
          borderRadius: 999,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WeatherIcon code={code} isDay={isDay} size={34} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.01em" }}>
          {name}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              background: "#cfe1f2",
              color: BRAND,
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {Math.round(tMin)}°
          </span>
          <span
            style={{
              background: "#0d3563",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 12,
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
  absoluteHour,
  isDay,
}: {
  spot: Spot;
  dayIndex: number;
  absoluteHour: number;
  isDay: boolean;
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
    const hourlyCode =
      data.hourly.weathercode[absoluteHour] ??
      data.daily.weathercode[dayIndex] ??
      0;
    const tMin = data.daily.temperature_2m_min[dayIndex] ?? 0;
    const tMax = data.daily.temperature_2m_max[dayIndex] ?? 0;
    const html = renderToStaticMarkup(
      <MarkerPill name={spot.name} tMin={tMin} tMax={tMax} code={hourlyCode} isDay={isDay} />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [200, 64],
      iconAnchor: [100, 32],
    });
  }, [data, dayIndex, absoluteHour, isDay, spot]);

  return <Marker position={[spot.lat, spot.lon]} icon={icon} interactive={false} />;
}

// (Bodensee-Label entfernt)

function currentBaseHour(): number {
  // aktueller 3-h-Slot: 0,3,6,...,21
  const h = new Date().getHours();
  return Math.floor(h / 3) * 3;
}

const MAX_STEPS = 40; // 5 Tage × 8 (3-h-Schritte)

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();

  // baseHour = absolute Stunde "jetzt" (gerundet auf 3-h-Slot), gemessen ab heute 00:00.
  const [baseHour] = useState(() => currentBaseHour());
  const [stepOffset, setStepOffset] = useState(0);

  const absoluteHour = baseHour + stepOffset * 3;
  const dayIndex = Math.floor(absoluteHour / 24);
  const hourOfDay = absoluteHour % 24;
  const isDay = hourOfDay >= 6 && hourOfDay < 20;

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
      [sw.lat - 0.001, sw.lng - 0.001],
      [ne.lat + 0.001, ne.lng + 0.001],
    );
    return { bounds: extended, maxBounds: extended.pad(0.3) };
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground shadow-lg">
        Karte wird geladen …
      </div>
    );
  }

  const hourLabel = `${String(hourOfDay).padStart(2, "0")}:00`;
  const activeDayLabel = formatDayLabel(
    days[Math.min(dayIndex, days.length - 1)],
    dayIndex,
  );

  const goHome = () => {
    router.navigate({ to: "/" }).catch(() => {
      if (typeof window !== "undefined") window.location.assign("/");
    });
  };

  return (
    <div className="space-y-4">
      {/* Karte */}
      <div className="relative h-[600px] w-full overflow-hidden rounded-2xl shadow-lg">
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [8, 8] }}
          maxBounds={maxBounds}
          maxBoundsViscosity={1.0}
          minZoom={9}
          maxZoom={17}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={true}
          style={{ height: "100%", width: "100%", background: "#e8edef" }}
        >
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Relief-Schummerung (swissALTI3D) */}
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
            maxZoom={18}
            opacity={0.35}
          />
          {/* Aussen-Maske: dunkleres Grau (See + Region ausgestanzt) */}
          <GeoJSON
            data={OUTSIDE_MASK}
            style={() => ({
              stroke: false,
              fillColor: "#5a6670",
              fillOpacity: 0.78,
            })}
            interactive={false}
          />
          {/* See unter der Region zeichnen */}
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
          {/* Region innen: klickbar → Symbolprognose */}
          <GeoJSON
            data={REGION}
            style={() => ({
              color: BRAND,
              weight: 2,
              opacity: 0.9,
              fillColor: "#7ebd5a",
              fillOpacity: 0.55,
            })}
            eventHandlers={{
              click: () => goHome(),
              mouseover: (e) => {
                const layer = e.propagatedFrom ?? e.target;
                if (layer && typeof layer.setStyle === "function") {
                  layer.setStyle({ fillOpacity: 0.55 });
                }
              },
              mouseout: (e) => {
                const layer = e.propagatedFrom ?? e.target;
                if (layer && typeof layer.setStyle === "function") {
                  layer.setStyle({ fillOpacity: 0.55 });
                }
              },
            }}
          />
          {SPOTS.map((s) => (
            <SpotMarker
              key={s.id}
              spot={s}
              dayIndex={dayIndex}
              absoluteHour={absoluteHour}
              isDay={isDay}
            />
          ))}
          <ZoomControl position="topright" />
        </MapContainer>
      </div>

      {/* Tages-Anzeige (highlight nach Slider-Position) */}
      <div className="inline-flex w-full gap-1 rounded-full bg-muted p-1">
        {days.map((d, i) => {
          const { top, sub } = formatDayLabel(d, i);
          const active = i === dayIndex;
          // Sprung zu 00:00 dieses Tages (heute: aktuelle Zeit)
          const jumpOffset = i === 0 ? 0 : Math.ceil((i * 24 - baseHour) / 3);
          const reachable = jumpOffset >= 0 && jumpOffset <= MAX_STEPS;
          return (
            <button
              key={i}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && setStepOffset(jumpOffset)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-white shadow"
                  : "text-foreground hover:bg-foreground/5",
                !reachable && "opacity-40",
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

      {/* Durchgehender 3-Stunden-Zeitstrahl ab jetzt */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {activeDayLabel.top}
            </span>
            <span className="text-xs text-muted-foreground">
              {activeDayLabel.sub}
            </span>
          </div>
          <span
            className="rounded-md px-2 py-0.5 text-sm font-bold text-white"
            style={{ background: BRAND }}
          >
            {hourLabel}
          </span>
        </div>
        <Slider
          min={0}
          max={MAX_STEPS}
          step={1}
          value={[stepOffset]}
          onValueChange={(v) => setStepOffset(v[0] ?? 0)}
        />
        <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>jetzt</span>
          <span>+{Math.round((MAX_STEPS * 3) / 24)} Tage</span>
        </div>
      </div>
    </div>
  );
}
