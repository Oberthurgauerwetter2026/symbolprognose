import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Marker, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import regionData from "@/data/region.json";
import { fetchForecast } from "@/lib/weather";
import { WeatherIcon } from "@/components/weather-icons";

type Spot = { id: string; name: string; lat: number; lon: number };

const SPOTS: Spot[] = [
  { id: "horn", name: "Horn", lat: 47.4986, lon: 9.4470 },
  { id: "amriswil", name: "Amriswil", lat: 47.5469, lon: 9.2986 },
  { id: "sitterdorf", name: "Sitterdorf", lat: 47.5028, lon: 9.2336 },
  { id: "muensterlingen", name: "Münsterlingen", lat: 47.6306, lon: 9.2378 },
];

const REGION = regionData as unknown as FeatureCollection;

// Build a "mask" polygon: world rectangle with all region polygons cut out as holes.
const MASK: Feature<Polygon> = (() => {
  const world: number[][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const holes: number[][][] = [];
  for (const f of REGION.features) {
    if (f.geometry.type === "Polygon") {
      // Outer ring only — inner rings of source polygons can be ignored for the mask.
      const outer = f.geometry.coordinates[0];
      if (outer && outer.length >= 4) holes.push(outer as number[][]);
    } else if (f.geometry.type === "MultiPolygon") {
      for (const poly of f.geometry.coordinates) {
        const outer = poly[0];
        if (outer && outer.length >= 4) holes.push(outer as number[][]);
      }
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [world, ...holes],
    },
  };
})();

function currentHourIso(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

function useCurrentHour(): string {
  const [hour, setHour] = useState<string>(() => currentHourIso());
  useEffect(() => {
    const id = setInterval(() => {
      const next = currentHourIso();
      setHour((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

function findHourIndex(times: string[], hourIso: string): number {
  const target = hourIso.slice(0, 13);
  for (let i = 0; i < times.length; i++) {
    if ((times[i] ?? "").slice(0, 13) === target) return i;
  }
  const t = new Date(hourIso).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]).getTime() - t);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

function MarkerCard({
  name,
  temp,
  wind,
  windDir,
  code,
}: {
  name: string;
  temp: number;
  wind: number;
  windDir: number;
  code: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 10px 7px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 8px 24px rgba(12, 35, 64, 0.18)",
        minWidth: 96,
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#0c2340",
        lineHeight: 1.1,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          background: "#0c2340",
          color: "#fff",
          padding: "2px 8px",
          borderRadius: 999,
          marginBottom: 4,
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#5cbdb9",
            boxShadow: "0 0 0 2px rgba(92,189,185,0.25)",
          }}
        />
        <WeatherIcon code={code} size={26} />
        <span
          style={{
            fontFamily: '"Outfit", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {Math.round(temp)}°
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          marginTop: 3,
          opacity: 0.85,
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{ transform: `rotate(${windDir}deg)` }}
        >
          <path d="M5 0 L8 9 L5 7 L2 9 Z" fill="#0c2340" />
        </svg>
        <span>{Math.round(wind)} km/h</span>
      </div>
    </div>
  );
}

function SpotMarker({ spot, hourIso }: { spot: Spot; hourIso: string }) {
  const { data } = useQuery({
    queryKey: ["map-weather", spot.id, hourIso],
    queryFn: () => fetchForecast(spot.lat, spot.lon),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const icon = useMemo(() => {
    if (!data) {
      const html = renderToStaticMarkup(
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.6)",
            fontFamily: '"Figtree", system-ui, sans-serif',
            fontSize: 12,
            color: "#0c2340",
          }}
        >
          {spot.name}
        </div>,
      );
      return L.divIcon({
        html,
        className: "region-map-marker",
        iconSize: [90, 28],
        iconAnchor: [45, 14],
      });
    }
    const i = findHourIndex(data.hourly.time, hourIso);
    const html = renderToStaticMarkup(
      <MarkerCard
        name={spot.name}
        temp={data.hourly.temperature_2m[i] ?? 0}
        wind={data.hourly.windspeed_10m[i] ?? 0}
        windDir={data.hourly.winddirection_10m[i] ?? 0}
        code={data.hourly.weathercode[i] ?? 0}
      />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [110, 82],
      iconAnchor: [55, 41],
    });
  }, [data, hourIso, spot]);

  return <Marker position={[spot.lat, spot.lon]} icon={icon} />;
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hourIso = useCurrentHour();

  const { bounds, maxBounds } = useMemo(() => {
    const layer = L.geoJSON(REGION);
    const b = layer.getBounds();
    return { bounds: b, maxBounds: b.pad(0.2) };
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground shadow-lg">
        Karte wird geladen …
      </div>
    );
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-2xl shadow-lg">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        minZoom={11}
        maxZoom={16}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#eef2f6" }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <GeoJSON
          data={MASK}
          style={() => ({
            color: "transparent",
            weight: 0,
            fillColor: "#0c2340",
            fillOpacity: 0.35,
            fillRule: "evenodd",
          })}
          interactive={false}
        />
        <GeoJSON
          data={REGION}
          style={() => ({
            color: "#0c2340",
            weight: 2.5,
            fill: false,
            opacity: 0.9,
          })}
          interactive={false}
        />
        {SPOTS.map((s) => (
          <SpotMarker key={s.id} spot={s} hourIso={hourIso} />
        ))}
        <ZoomControl position="topright" />
      </MapContainer>
    </div>
  );
}
