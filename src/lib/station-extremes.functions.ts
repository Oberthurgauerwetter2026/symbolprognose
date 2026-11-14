import { createServerFn } from "@tanstack/react-start";
import { EXTREME_REFERENCE_STATIONS, stationReadings, zurichDay, type ExtremeDailyReading, type StationLiveReading, type StationExtreme } from "./station-extremes";

const HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co";
// Öffentlicher Lese-Schlüssel des Weather Hub (wie in own-stations.server.ts).
const HUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU";

/** Tageswerte und aktuelle Temperaturen derselben neun regionalen Stationen. */
export const getStationExtremes = createServerFn({ method: "GET" }).handler(async (): Promise<StationExtreme[]> => {
  const { OWN_STATIONS } = await import("./own-stations.server");
  const now = Date.now(), day = zurichDay(now);
  const stations = [...OWN_STATIONS, ...EXTREME_REFERENCE_STATIONS];
  const ids = stations.map((s) => s.id).join(",");
  try {
    const read = async <T,>(path: string): Promise<T[]> => {
      try {
        const res = await fetch(`${HUB_URL}/rest/v1/${path}`, {
          headers: { apikey: HUB_KEY, accept: "application/json" }, signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) { console.warn("[station-maps] source HTTP", res.status); return []; }
        return await res.json() as T[];
      } catch { return []; }
    };
    const rows = await read<ExtremeDailyReading>(`readings_daily?select=station_id,temp_min,temp_max,wind_max_gust,rain_sum&day=eq.${day}&station_id=in.(${ids})`);
    const live: StationLiveReading[] = [];
    // Höchstens sechs gleichzeitige Verbindungen; pro Station exakt die jüngste Messung.
    for (let i = 0; i < stations.length; i += 6) {
      const chunk = await Promise.all(stations.slice(i, i + 6).map((station) =>
        read<StationLiveReading>(`readings?select=station_id,measured_at,temperature&station_id=eq.${station.id}&order=measured_at.desc&limit=1`)));
      live.push(...chunk.flat());
    }
    return stationReadings(stations, rows, live, now);
  } catch {
    return [];
  }
});
