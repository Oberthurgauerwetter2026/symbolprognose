import { createServerFn } from "@tanstack/react-start";
import {
  fetchForecast,
  sanitizeForecast,
  type DailyData,
  type ForecastResponse,
  type HourlyData,
} from "./weather";
import { getOpenMeteoCache } from "./openmeteo-cache.server";

/**
 * Serverseitiges Multi-Modell-Aggregat.
 *
 * Primärquelle ist der R2-Cache (`openmeteo/forecast.json` -> phaseA), der vom
 * GitHub-Workflow `openmeteo-ingest.yml` alle 5 min frisch geschrieben wird.
 * Damit umgehen wir das IP-Rate-Limit, das Open-Meteo auf den Cloudflare-
 * Worker-Egress ausspielt. Fällt der Cache aus, greift `fetchForecast()` als
 * Last-Resort auf api.open-meteo.com direkt zu.
 *
 * `v` ist ein reiner Cache-Bust-Parameter: erhöhen, wenn sich die Aggregations-
 * oder Symbol-Logik ändert und alte Edge-Cache-Antworten umgangen werden müssen.
 */

type Series = Record<string, (number | string | null)[]>;
type Loc = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: Series;
  daily?: Series;
};

const CACHE_MODEL_SUFFIXES = [
  "meteoswiss_icon_ch2",
  "icon_d2",
  "arpege_europe",
  "meteofrance_arome_france_hd",
  "ecmwf_ifs025",
  "gfs_global",
] as const;

function dist2(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = a.lat - b.lat;
  const dLon = a.lon - b.lon;
  return dLat * dLat + dLon * dLon;
}

function pickNearest(locs: Loc[], lat: number, lon: number): Loc | null {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < locs.length; i++) {
    const la = locs[i]?.latitude;
    const lo = locs[i]?.longitude;
    if (typeof la !== "number" || typeof lo !== "number") continue;
    const d = dist2({ lat, lon }, { lat: la, lon: lo });
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? locs[bestIdx] : null;
}

/** Open-Meteo neue Feldnamen (wind_speed_10m) → ForecastResponse-Namen (windspeed_10m). */
function pickArr(s: Series | undefined, ...keys: string[]): (number | null)[] {
  if (!s) return [];
  for (const k of keys) {
    const a = s[k];
    if (Array.isArray(a)) return a as (number | null)[];
    for (const suffix of CACHE_MODEL_SUFFIXES) {
      const modelArr = s[`${k}_${suffix}`];
      if (Array.isArray(modelArr)) return modelArr as (number | null)[];
    }
  }
  return [];
}
function pickStrArr(s: Series | undefined, ...keys: string[]): string[] {
  if (!s) return [];
  for (const k of keys) {
    const a = s[k];
    if (Array.isArray(a)) return (a as (string | null)[]).map((v) => v ?? "");
    for (const suffix of CACHE_MODEL_SUFFIXES) {
      const modelArr = s[`${k}_${suffix}`];
      if (Array.isArray(modelArr)) return (modelArr as (string | null)[]).map((v) => v ?? "");
    }
  }
  return [];
}

function buildForecastFromCacheLoc(loc: Loc): ForecastResponse {
  const h = loc.hourly;
  const d = loc.daily;

  const hourly: HourlyData = {
    time: pickStrArr(h, "time"),
    weathercode: pickArr(h, "weathercode", "weather_code") as number[],
    temperature_2m: pickArr(h, "temperature_2m") as number[],
    precipitation: pickArr(h, "precipitation") as number[],
    precipitation_probability: pickArr(h, "precipitation_probability") as number[],
    windspeed_10m: pickArr(h, "windspeed_10m", "wind_speed_10m") as number[],
    windgusts_10m: pickArr(h, "windgusts_10m", "wind_gusts_10m") as number[],
    winddirection_10m: pickArr(h, "winddirection_10m", "wind_direction_10m") as number[],
    snowfall: pickArr(h, "snowfall") as number[],
    sunshine_duration: pickArr(h, "sunshine_duration") as number[],
    cloud_cover_low: pickArr(h, "cloud_cover_low", "cloudcover_low") as number[],
    cloud_cover_mid: pickArr(h, "cloud_cover_mid", "cloudcover_mid") as number[],
    cloud_cover_high: pickArr(h, "cloud_cover_high", "cloudcover_high") as number[],
  };

  const daily: DailyData = {
    time: pickStrArr(d, "time"),
    weathercode: pickArr(d, "weathercode", "weather_code") as number[],
    temperature_2m_max: pickArr(d, "temperature_2m_max") as number[],
    temperature_2m_min: pickArr(d, "temperature_2m_min") as number[],
    precipitation_sum: pickArr(d, "precipitation_sum") as number[],
    precipitation_probability_max: pickArr(d, "precipitation_probability_max") as number[],
    windspeed_10m_max: pickArr(d, "windspeed_10m_max", "wind_speed_10m_max") as number[],
    windgusts_10m_max: pickArr(d, "windgusts_10m_max", "wind_gusts_10m_max") as number[],
    winddirection_10m_dominant: pickArr(
      d,
      "winddirection_10m_dominant",
      "wind_direction_10m_dominant",
    ) as number[],
    sunshine_duration: pickArr(d, "sunshine_duration") as number[],
    sunrise: pickStrArr(d, "sunrise"),
    sunset: pickStrArr(d, "sunset"),
    snowfall_sum: pickArr(d, "snowfall_sum") as number[],
    precipitation_hours: pickArr(d, "precipitation_hours") as number[],
  };

  return sanitizeForecast({
    latitude: loc.latitude ?? 0,
    longitude: loc.longitude ?? 0,
    timezone: loc.timezone ?? "Europe/Zurich",
    hourly,
    daily,
  });
}

async function forecastFromCache(
  lat: number,
  lon: number,
): Promise<ForecastResponse | null> {
  const cache = await getOpenMeteoCache();
  const locs = cache?.phaseA as Loc[] | undefined;
  if (!locs?.length) return null;
  const best = pickNearest(locs, lat, lon);
  if (!best?.hourly?.time?.length) return null;
  return buildForecastFromCacheLoc(best);
}

export const getAggregatedForecast = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number; v?: string | number }) => {
    if (typeof input?.lat !== "number" || typeof input?.lon !== "number") {
      throw new Error("lat/lon required");
    }
    return {
      lat: Math.round(input.lat * 10_000) / 10_000,
      lon: Math.round(input.lon * 10_000) / 10_000,
      v: input?.v != null ? String(input.v) : undefined,
    };
  })
  .handler(async ({ data }): Promise<ForecastResponse> => {
    const cached = await forecastFromCache(data.lat, data.lon);
    if (cached) return cached;

    // Fallback: R2 leer / nicht erreichbar → direkter Open-Meteo-Call
    // (kann am Worker-IP-Rate-Limit scheitern, deshalb nur Last Resort).
    console.warn(
      "[aggregated-forecast] R2 cache miss for",
      data.lat,
      data.lon,
      "— falling back to direct Open-Meteo",
    );
    return await fetchForecast(data.lat, data.lon);
  });
