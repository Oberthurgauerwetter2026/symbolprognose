import { createServerFn } from "@tanstack/react-start";
import { buildStationView, stationSlug, type RawReading, type StationView } from "./station-view";
import { zurichDay } from "./rain-overrides";

const HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co";
// Öffentlicher Lese-Schlüssel des Weather Hub (wie in own-stations.server.ts).
const HUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU";

/** Live- und Tageswerte einer eigenen Station (ohne MeteoSchweiz). null = unbekannte Station. */
export const getStationView = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 40) }))
  .handler(async ({ data }): Promise<StationView | null> => {
    const { OWN_STATIONS } = await import("./own-stations.server");
    const st = OWN_STATIONS.find((s) => stationSlug(s.name) === data.slug);
    if (!st) return null;
    const now = Date.now();
    const read = async <T,>(path: string): Promise<T[]> => {
      try {
        const res = await fetch(`${HUB_URL}/rest/v1/${path}`, { headers: { apikey: HUB_KEY, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
        return res.ok ? ((await res.json()) as T[]) : [];
      } catch { return []; }
    };
    const since = new Date(now - 50 * 3_600_000).toISOString();
    const today = zurichDay(now), yest = zurichDay(now - 86_400_000);
    const [rows, daily] = await Promise.all([
      read<RawReading>(`readings?select=measured_at,temperature,dew_point,humidity,pressure,rain_rate,wind_speed,wind_gust,wind_dir&station_id=eq.${st.id}&measured_at=gt.${encodeURIComponent(since)}&order=measured_at.asc&limit=1000`),
      read<{ day: string; rain_sum: number | null }>(`readings_daily?select=day,rain_sum&station_id=eq.${st.id}&day=in.(${today},${yest})`),
    ]);
    const rain = (d: string) => { const r = daily.find((x) => String(x.day).slice(0, 10) === d); return r && r.rain_sum !== null ? Number(r.rain_sum) : null; };
    return buildStationView(st.name, rows, { today: rain(today), yesterday: rain(yest) }, now);
  });
