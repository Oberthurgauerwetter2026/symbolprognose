/**
 * Eigene Meteobridge-Stationen aus dem Weather Hub (live-wetterkarte.lovable.app).
 * Liest die öffentlich lesbaren 10-Minuten-Werte (rain_inc) und summiert sie
 * mit derselben getesteten Fensterlogik wie die MeteoSchweiz-Stationen.
 */
import { PAST_WINDOWS } from "./precip-past";
import { stationWindowSum, type Sample, type StationDef } from "./station-sums";

const HUB_URL = "https://eqnhgnirvpblmmvtdzvo.supabase.co";
// Öffentlicher (publishable) Schlüssel des Weather Hub – nur Lesezugriff auf freigegebene Messwerte.
const HUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmhnbmlydnBibG1tdnRkenZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQwMjAsImV4cCI6MjA5NDYwMDAyMH0.w-MBYTiHoOiE-DX3Hyf-1dsAC2DxGZzJ0YoQUlkwpZU";

/** Koordinaten aus dem Weather-Hub-Admin; MeteoSchweiz-Stationen dort sind bewusst ausgelassen. */
export const OWN_STATIONS: StationDef[] = [
  { id: "69a6f29c-6603-43fe-90a7-c92796183531", name: "Amriswil", lat: 47.5531, lon: 9.3204, alt: 437 },
  { id: "ba4b631b-cf76-4b79-8f0d-4f9a334e02a4", name: "Uttwil", lat: 47.578, lon: 9.3504, alt: 405 },
  { id: "6a6d8137-9ce5-4292-a2a8-1c89c0d70be7", name: "Horn", lat: 47.492, lon: 9.4524, alt: 400 },
  { id: "03528d1a-939b-4410-9155-9f44c1ea8a8d", name: "Landschlacht", lat: 47.6263, lon: 9.2474, alt: 405 },
  { id: "08a9336c-79c7-4b31-9fad-8db3feb2ad84", name: "Egnach", lat: 47.5326, lon: 9.3815, alt: 420 },
  { id: "49335a93-c655-4459-a1be-45a7cedad550", name: "Opfershofen", lat: 47.5592, lon: 9.1733, alt: 520 },
  { id: "2f0d7491-788a-494c-a03c-0b4fc96460e5", name: "Roggwil", lat: 47.5076, lon: 9.3806, alt: 440 },
];

export type OwnStationPoint = StationDef & {
  rain: Record<string, number | null>;
  snow: Record<string, number | null>;
  source: "own";
};

async function loadOne(st: StationDef, now: number): Promise<OwnStationPoint | null> {
  const since = new Date(now - 72 * 3_600_000 - 600_000).toISOString();
  const url =
    `${HUB_URL}/rest/v1/readings?select=measured_at,rain_inc` +
    `&station_id=eq.${st.id}&measured_at=gt.${encodeURIComponent(since)}&order=measured_at.asc&limit=1000`;
  const res = await fetch(url, { headers: { apikey: HUB_KEY, accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { measured_at: string; rain_inc: number | null }[];
  const samples: Sample[] = rows.map((r) => ({
    t: Date.parse(r.measured_at),
    precip: typeof r.rain_inc === "number" && r.rain_inc >= 0 ? r.rain_inc : null,
    snowDepth: null,
    dur: 600_000,
  }));
  const rain: Record<string, number | null> = {};
  const snow: Record<string, number | null> = {};
  for (const w of PAST_WINDOWS) {
    rain[w] = stationWindowSum(samples, now, w).rain;
    snow[w] = null;
  }
  return { ...st, rain, snow, source: "own" };
}

export async function loadOwnStations(now: number): Promise<OwnStationPoint[]> {
  const res = await Promise.all(
    OWN_STATIONS.map((st) =>
      loadOne(st, now).catch((e) => {
        console.warn(`[past-sums] own station ${st.name}: ${(e as Error).message}`);
        return null;
      }),
    ),
  );
  return res.filter((x): x is OwnStationPoint => !!x && Object.values(x.rain).some((v) => v !== null));
}
