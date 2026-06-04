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

/**
 * Per-Index-Merge über alle Modell-Spalten: hochauflösende Modelle zuerst,
 * ECMWF/GFS als Lückenfüller für späte Tage. Liefert immer ein Array der
 * längsten gefundenen Spalte; Indizes ohne Wert bleiben `null`.
 */
function collectArrs(s: Series | undefined, keys: string[]): (number | null)[][] {
  if (!s) return [];
  const out: (number | null)[][] = [];
  for (const k of keys) {
    const unsuf = s[k];
    if (Array.isArray(unsuf)) out.push(unsuf as (number | null)[]);
    for (const suffix of CACHE_MODEL_SUFFIXES) {
      const a = s[`${k}_${suffix}`];
      if (Array.isArray(a)) out.push(a as (number | null)[]);
    }
  }
  return out;
}
function mergeArr(s: Series | undefined, ...keys: string[]): (number | null)[] {
  const arrs = collectArrs(s, keys);
  if (!arrs.length) return [];
  const len = arrs.reduce((m, a) => Math.max(m, a.length), 0);
  const out: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    for (const a of arrs) {
      const v = a[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[i] = v;
        break;
      }
    }
  }
  return out;
}
function collectStrArrs(s: Series | undefined, keys: string[]): (string | null)[][] {
  if (!s) return [];
  const out: (string | null)[][] = [];
  for (const k of keys) {
    const unsuf = s[k];
    if (Array.isArray(unsuf)) out.push(unsuf as (string | null)[]);
    for (const suffix of CACHE_MODEL_SUFFIXES) {
      const a = s[`${k}_${suffix}`];
      if (Array.isArray(a)) out.push(a as (string | null)[]);
    }
  }
  return out;
}
function mergeStrArr(s: Series | undefined, ...keys: string[]): string[] {
  const arrs = collectStrArrs(s, keys);
  if (!arrs.length) return [];
  const len = arrs.reduce((m, a) => Math.max(m, a.length), 0);
  const out: string[] = new Array(len).fill("");
  for (let i = 0; i < len; i++) {
    for (const a of arrs) {
      const v = a[i];
      if (typeof v === "string" && v.length > 0) {
        out[i] = v;
        break;
      }
    }
  }
  return out;
}

function padNum(arr: number[], len: number, fill = 0): number[] {
  if (arr.length >= len) return arr.slice(0, len);
  const out = arr.slice();
  while (out.length < len) out.push(fill);
  return out;
}
function padStr(arr: string[], len: number, fill = ""): string[] {
  if (arr.length >= len) return arr.slice(0, len);
  const out = arr.slice();
  while (out.length < len) out.push(fill);
  return out;
}

function buildForecastFromCacheLoc(loc: Loc): ForecastResponse {
  const h = loc.hourly;
  const d = loc.daily;

  const hTime = pickStrArr(h, "time");
  const hLen = hTime.length;
  const hourly: HourlyData = {
    time: hTime,
    weathercode: padNum(pickArr(h, "weathercode", "weather_code") as number[], hLen),
    temperature_2m: padNum(pickArr(h, "temperature_2m") as number[], hLen),
    precipitation: padNum(pickArr(h, "precipitation") as number[], hLen),
    precipitation_probability: padNum(pickArr(h, "precipitation_probability") as number[], hLen),
    windspeed_10m: padNum(pickArr(h, "windspeed_10m", "wind_speed_10m") as number[], hLen),
    windgusts_10m: padNum(pickArr(h, "windgusts_10m", "wind_gusts_10m") as number[], hLen),
    winddirection_10m: padNum(
      pickArr(h, "winddirection_10m", "wind_direction_10m") as number[],
      hLen,
    ),
    snowfall: padNum(pickArr(h, "snowfall") as number[], hLen),
    sunshine_duration: padNum(pickArr(h, "sunshine_duration") as number[], hLen),
    cloud_cover_low: padNum(pickArr(h, "cloud_cover_low", "cloudcover_low") as number[], hLen),
    cloud_cover_mid: padNum(pickArr(h, "cloud_cover_mid", "cloudcover_mid") as number[], hLen),
    cloud_cover_high: padNum(pickArr(h, "cloud_cover_high", "cloudcover_high") as number[], hLen),
  };

  const dTime = pickStrArr(d, "time");
  const dLen = dTime.length;
  const daily: DailyData = {
    time: dTime,
    weathercode: padNum(pickArr(d, "weathercode", "weather_code") as number[], dLen),
    temperature_2m_max: padNum(pickArr(d, "temperature_2m_max") as number[], dLen),
    temperature_2m_min: padNum(pickArr(d, "temperature_2m_min") as number[], dLen),
    precipitation_sum: padNum(pickArr(d, "precipitation_sum") as number[], dLen),
    precipitation_probability_max: padNum(
      pickArr(d, "precipitation_probability_max") as number[],
      dLen,
    ),
    windspeed_10m_max: padNum(
      pickArr(d, "windspeed_10m_max", "wind_speed_10m_max") as number[],
      dLen,
    ),
    windgusts_10m_max: padNum(
      pickArr(d, "windgusts_10m_max", "wind_gusts_10m_max") as number[],
      dLen,
    ),
    winddirection_10m_dominant: padNum(
      pickArr(d, "winddirection_10m_dominant", "wind_direction_10m_dominant") as number[],
      dLen,
    ),
    sunshine_duration: padNum(pickArr(d, "sunshine_duration") as number[], dLen),
    sunrise: padStr(pickStrArr(d, "sunrise"), dLen),
    sunset: padStr(pickStrArr(d, "sunset"), dLen),
    snowfall_sum: padNum(pickArr(d, "snowfall_sum") as number[], dLen),
    precipitation_hours: padNum(pickArr(d, "precipitation_hours") as number[], dLen),
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

function emptyForecast(lat: number, lon: number): ForecastResponse {
  return sanitizeForecast({
    latitude: lat,
    longitude: lon,
    timezone: "Europe/Zurich",
    hourly: {
      time: [],
      weathercode: [],
      temperature_2m: [],
      precipitation: [],
      precipitation_probability: [],
      windspeed_10m: [],
      windgusts_10m: [],
      winddirection_10m: [],
      snowfall: [],
      sunshine_duration: [],
      cloud_cover_low: [],
      cloud_cover_mid: [],
      cloud_cover_high: [],
    },
    daily: {
      time: [],
      weathercode: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: [],
      precipitation_probability_max: [],
      windspeed_10m_max: [],
      windgusts_10m_max: [],
      winddirection_10m_dominant: [],
      sunshine_duration: [],
      sunrise: [],
      sunset: [],
      snowfall_sum: [],
      precipitation_hours: [],
    },
  });
}

export const getAggregatedForecast = createServerFn({ method: "POST" })
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
    try {
      const cached = await forecastFromCache(data.lat, data.lon);
      if (cached) return cached;
    } catch (err) {
      console.error("[aggregated-forecast] cache read failed", err);
    }

    // Fallback: R2 leer / nicht erreichbar → direkter Open-Meteo-Call
    // (kann am Worker-IP-Rate-Limit scheitern, deshalb nur Last Resort).
    console.warn(
      "[aggregated-forecast] R2 cache miss for",
      data.lat,
      data.lon,
      "— falling back to direct Open-Meteo",
    );
    try {
      return await fetchForecast(data.lat, data.lon);
    } catch (err) {
      console.error("[aggregated-forecast] hard fail", err);
      return emptyForecast(data.lat, data.lon);
    }
  });
