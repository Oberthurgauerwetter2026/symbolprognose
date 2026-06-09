/**
 * Server-only Helper: zieht den aktuellen Messwert der Meteobridge-Station
 * "Oberthurgau" aus dem Weather-Hub-Projekt (live-wetterkarte.lovable.app).
 *
 * Voraussetzung: Im Weather-Hub-Projekt existiert ein öffentlicher Lese-
 * Endpoint unter /api/public/stations?name=Oberthurgau, der ein JSON-Array
 * mit mind. { name, temperature, rain_rate, measured_at } liefert.
 *
 * Bei Fehler/Timeout wird null zurückgegeben, damit das Embed weiterhin
 * mit Open-Meteo-Werten rendert.
 */

const STATION_URL =
  "https://live-wetterkarte.lovable.app/api/public/stations?name=Oberthurgau";

const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 2_000;

export type StationCurrent = {
  temperature: number | null;
  rain_rate: number | null;
  measured_at: string | null;
};

let cache: { at: number; value: StationCurrent | null } | null = null;

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function fetchOberthurgauStation(): Promise<StationCurrent | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(STATION_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[weather-hub] HTTP ${res.status} for Oberthurgau`);
      cache = { at: Date.now(), value: null };
      return null;
    }
    const json = (await res.json()) as unknown;
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { data?: unknown })?.data)
      ? ((json as { data: unknown[] }).data as unknown[])
      : [];
    const row = arr.find(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        (r as { name?: unknown }).name === "Oberthurgau",
    ) as Record<string, unknown> | undefined;

    if (!row) {
      cache = { at: Date.now(), value: null };
      return null;
    }

    const value: StationCurrent = {
      temperature: asNum(row.temperature),
      rain_rate: asNum(row.rain_rate),
      measured_at: asStr(row.measured_at),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn("[weather-hub] fetch failed", err);
    cache = { at: Date.now(), value: null };
    return null;
  } finally {
    clearTimeout(timer);
  }
}
