import { createServerFn } from "@tanstack/react-start";
import { EXTREME_REFERENCE_STATIONS, stationExtremes, zurichDay, type ExtremeDailyReading, type StationExtreme } from "./station-extremes";

const HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co";
// Öffentlicher Lese-Schlüssel des Weather Hub (wie in own-stations.server.ts).
const HUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU";

/** Heutige Tmin/Tmax der eigenen und beiden regionalen MeteoSchweiz-Stationen. */
export const getStationExtremes = createServerFn({ method: "GET" }).handler(async (): Promise<StationExtreme[]> => {
  const { OWN_STATIONS } = await import("./own-stations.server");
  const day = zurichDay(Date.now());
  const stations = [...OWN_STATIONS, ...EXTREME_REFERENCE_STATIONS];
  const ids = stations.map((s) => s.id).join(",");
  try {
    const res = await fetch(`${HUB_URL}/rest/v1/readings_daily?select=station_id,temp_min,temp_max&day=eq.${day}&station_id=in.(${ids})`, {
      headers: { apikey: HUB_KEY, accept: "application/json" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as ExtremeDailyReading[];
    return stationExtremes(stations, rows);
  } catch {
    return [];
  }
});
