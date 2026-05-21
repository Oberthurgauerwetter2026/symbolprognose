import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { FeatureCollection } from "geojson";

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
  const target = hourIso.slice(0, 13); // YYYY-MM-DDTHH
  for (let i = 0; i < times.length; i++) {
    if ((times[i] ?? "").slice(0, 13) === target) return i;
  }
  // Fallback: closest in time
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
        padding: "6px 10px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(12, 35, 64, 0.18)",
        boxShadow: "0 4px 12px rgba(12, 35, 64, 0.18)",
        minWidth: 88,
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#0c2340",
        lineHeight: 1.1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <WeatherIcon code={code} size={28} />
        <span style={{ fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 700, fontSize: 18 }}>
          {Math.round(temp)}°
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginTop: 2 }}>
        <span
          style={{
            display: "inline-block",
            transform: `rotate(${windDir}deg)`,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ↓
        </span>
        <span>{Math.round(wind)} km/h</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>{name}</div>
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
            borderRadius: 10,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(12,35,64,0.18)",
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
        iconSize: [80, 28],
        iconAnchor: [40, 14],
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
      iconSize: [100, 70],
      iconAnchor: [50, 35],
    });
  }, [data, hourIso, spot]);

  return <Marker position={[spot.lat, spot.lon]} icon={icon} />;
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hourIso = useCurrentHour();

  if (!mounted) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        Karte wird geladen …
      </div>
    );
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border">
      <MapContainer
        center={[47.555, 9.32]}
        zoom={11}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={REGION}
          style={() => ({
            color: "#0c2340",
            weight: 1.2,
            fillColor: "#5cbdb9",
            fillOpacity: 0.12,
          })}
        />
        {SPOTS.map((s) => (
          <SpotMarker key={s.id} spot={s} hourIso={hourIso} />
        ))}
      </MapContainer>
    </div>
  );
}
