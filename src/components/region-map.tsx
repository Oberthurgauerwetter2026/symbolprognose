import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, GeoJSON, Marker, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { FeatureCollection } from "geojson";

import regionData from "@/data/region.json";
import lakeData from "@/data/lake.json";
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
const LAKE = lakeData as unknown as FeatureCollection;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function useToday(): string {
  const [day, setDay] = useState<string>(() => todayIso());
  useEffect(() => {
    const id = setInterval(() => {
      const next = todayIso();
      setDay((p) => (p === next ? p : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return day;
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
        gap: 8,
        padding: "5px 12px 5px 5px",
        borderRadius: 999,
        background: "#1f4a7a",
        boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
        fontFamily: '"Figtree", system-ui, sans-serif',
        color: "#fff",
        lineHeight: 1.05,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WeatherIcon code={code} size={22} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}>
          {name}
        </div>
        <div style={{ display: "flex", gap: 4, fontSize: 10, fontWeight: 700 }}>
          <span
            style={{
              background: "#bcd8ec",
              color: "#1f4a7a",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {Math.round(tMin)}°
          </span>
          <span
            style={{
              background: "#0c2b52",
              color: "#fff",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {Math.round(tMax)}°
          </span>
        </div>
      </div>
    </div>
  );
}

function SpotMarker({ spot, day }: { spot: Spot; day: string }) {
  const { data } = useQuery({
    queryKey: ["map-weather", spot.id, day],
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
              padding: "4px 10px",
              borderRadius: 999,
              background: "#1f4a7a",
              color: "#fff",
              fontFamily: '"Figtree", system-ui, sans-serif',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {spot.name}
          </div>,
        ),
        className: "region-map-marker",
        iconSize: [100, 24],
        iconAnchor: [50, 12],
      });
    }
    const i = Math.max(0, data.daily.time.findIndex((t) => t === day));
    const idx = i === -1 ? 0 : i;
    const html = renderToStaticMarkup(
      <MarkerPill
        name={spot.name}
        tMin={data.daily.temperature_2m_min[idx] ?? 0}
        tMax={data.daily.temperature_2m_max[idx] ?? 0}
        code={data.daily.weathercode[idx] ?? 0}
      />,
    );
    return L.divIcon({
      html,
      className: "region-map-marker",
      iconSize: [120, 44],
      iconAnchor: [60, 22],
    });
  }, [data, day, spot]);

  return <Marker position={[spot.lat, spot.lon]} icon={icon} />;
}

export function RegionMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const day = useToday();

  const { bounds, maxBounds } = useMemo(() => {
    const layer = L.geoJSON(REGION);
    const b = layer.getBounds();
    return { bounds: b, maxBounds: b.pad(0.25) };
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
        maxZoom={14}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#1f2a36" }}
      >
        {/* Land = Region in sattem Grün */}
        <GeoJSON
          data={REGION}
          style={() => ({
            color: "#ffffff",
            weight: 1.2,
            opacity: 0.35,
            fillColor: "#8fbf7f",
            fillOpacity: 1,
          })}
          interactive={false}
        />
        {/* Bodensee */}
        <GeoJSON
          data={LAKE}
          style={() => ({
            color: "#7ec8e3",
            weight: 0,
            fillColor: "#7ec8e3",
            fillOpacity: 1,
          })}
          interactive={false}
        />
        {SPOTS.map((s) => (
          <SpotMarker key={s.id} spot={s} day={day} />
        ))}
        <ZoomControl position="topright" />
      </MapContainer>
    </div>
  );
}
