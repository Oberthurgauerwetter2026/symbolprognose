import { createServerFn } from "@tanstack/react-start";
import { zurichDay, type StationExtreme } from "./station-extremes";

const HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co";
// Öffentlicher Lese-Schlüssel des Weather Hub (wie in own-stations.server.ts).
const HUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU";

/** Heutige Tmin/Tmax aller eigenen Stationen aus der Weather-Hub-Tagestabelle. */
export const getStationExtremes = createServerFn({ method: "GET" }).handler(async (): Promise<StationExtreme[]> => {
  const { OWN_STATIONS } = await import("./own-stations.server");
  const day = zurichDay(Date.now());
  const ids = OWN_STATIONS.map((s) => s.id).join(",");
  try {
    const res = await fetch(`${HUB_URL}/rest/v1/readings_daily?select=station_id,temp_min,temp_max&day=eq.${day}&station_id=in.(${ids})`, {
      headers: { apikey: HUB_KEY, accept: "application/json" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { station_id: string; temp_min: number | null; temp_max: number | null }[];
    const by = new Map(rows.map((r) => [r.station_id, r]));
    return OWN_STATIONS.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, min: by.get(s.id)?.temp_min ?? null, max: by.get(s.id)?.temp_max ?? null }));
  } catch {
    return [];
  }
});
