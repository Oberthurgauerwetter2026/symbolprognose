import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import {
  fetchForecast,
  sanitizeForecast,
  aggregateDailyFromHourly,
  alignMosmixToTimeline,
  overwriteFromIndex,
  type DailyData,
  type ForecastResponse,
  type HourlyData,
} from "./weather";
import { fetchMosmix, type MosmixHourly } from "./mosmix.functions";
import { getSymbolCache } from "./openmeteo-cache.server";

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
  "icon_seamless",
  "icon_d2",
  "arpege_europe",
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
    weathercode: padNum(mergeArr(h, "weathercode", "weather_code") as number[], hLen),
    temperature_2m: padNum(mergeArr(h, "temperature_2m") as number[], hLen),
    precipitation: padNum(mergeArr(h, "precipitation") as number[], hLen),
    precipitation_probability: padNum(mergeArr(h, "precipitation_probability") as number[], hLen),
    windspeed_10m: padNum(mergeArr(h, "windspeed_10m", "wind_speed_10m") as number[], hLen),
    windgusts_10m: padNum(mergeArr(h, "windgusts_10m", "wind_gusts_10m") as number[], hLen),
    winddirection_10m: padNum(
      mergeArr(h, "winddirection_10m", "wind_direction_10m") as number[],
      hLen,
    ),
    snowfall: padNum(mergeArr(h, "snowfall") as number[], hLen),
    sunshine_duration: padNum(mergeArr(h, "sunshine_duration") as number[], hLen),
    cloud_cover_low: padNum(mergeArr(h, "cloud_cover_low", "cloudcover_low") as number[], hLen),
    cloud_cover_mid: padNum(mergeArr(h, "cloud_cover_mid", "cloudcover_mid") as number[], hLen),
    cloud_cover_high: padNum(mergeArr(h, "cloud_cover_high", "cloudcover_high") as number[], hLen),
  };

  const dTime = pickStrArr(d, "time");
  const dLen = dTime.length;
  const daily: DailyData = {
    time: dTime,
    weathercode: padNum(mergeArr(d, "weathercode", "weather_code") as number[], dLen),
    temperature_2m_max: padNum(mergeArr(d, "temperature_2m_max") as number[], dLen),
    temperature_2m_min: padNum(mergeArr(d, "temperature_2m_min") as number[], dLen),
    precipitation_sum: padNum(mergeArr(d, "precipitation_sum") as number[], dLen),
    precipitation_probability_max: padNum(
      mergeArr(d, "precipitation_probability_max") as number[],
      dLen,
    ),
    windspeed_10m_max: padNum(
      mergeArr(d, "windspeed_10m_max", "wind_speed_10m_max") as number[],
      dLen,
    ),
    windgusts_10m_max: padNum(
      mergeArr(d, "windgusts_10m_max", "wind_gusts_10m_max") as number[],
      dLen,
    ),
    winddirection_10m_dominant: padNum(
      mergeArr(d, "winddirection_10m_dominant", "wind_direction_10m_dominant") as number[],
      dLen,
    ),
    sunshine_duration: padNum(mergeArr(d, "sunshine_duration") as number[], dLen),
    sunrise: padStr(mergeStrArr(d, "sunrise"), dLen),
    sunset: padStr(mergeStrArr(d, "sunset"), dLen),
    snowfall_sum: padNum(mergeArr(d, "snowfall_sum") as number[], dLen),
    precipitation_hours: padNum(mergeArr(d, "precipitation_hours") as number[], dLen),
  };

  // Daily-Symbol & abgeleitete Niederschlagsfelder aus dem gemergten Hourly
  // neu aggregieren. Sonst kann der per-Modell-Daily-Code aus dem R2-Cache
  // (z. B. ICON-CH2 zeigt Schauer 80/81) im Widget erscheinen, obwohl die
  // gemergte Stundenkurve über alle Modelle den Tag trocken sieht.
  for (let i = 0; i < daily.time.length; i++) {
    const agg = aggregateDailyFromHourly(hourly, daily.time[i] ?? "");
    const wc = agg.weathercode;
    if (typeof wc === "number" && Number.isFinite(wc)) {
      daily.weathercode[i] = wc;
    }
    const ps = agg.precipitation_sum;
    if (typeof ps === "number" && Number.isFinite(ps)) {
      daily.precipitation_sum[i] = ps;
    }
    const ph = agg.precipitation_hours;
    if (typeof ph === "number" && Number.isFinite(ph)) {
      daily.precipitation_hours[i] = ph;
    }
    const sd = agg.sunshine_duration;
    if (typeof sd === "number" && Number.isFinite(sd)) {
      daily.sunshine_duration[i] = sd;
    }
  }

  return sanitizeForecast({
    latitude: loc.latitude ?? 0,
    longitude: loc.longitude ?? 0,
    timezone: loc.timezone ?? "Europe/Zurich",
    hourly,
    daily,
  });
}

async function loadSymbolLocs(): Promise<Loc[] | null> {
  const cache = await getSymbolCache();
  const locs = cache?.phaseA as Loc[] | undefined;
  return locs?.length ? locs : null;
}

async function forecastFromCache(
  lat: number,
  lon: number,
): Promise<ForecastResponse | null> {
  const locs = await loadSymbolLocs();
  if (!locs) return null;
  const best = pickNearest(locs, lat, lon);
  if (!best?.hourly?.time?.length) return null;
  return buildForecastFromCacheLoc(best);
}

/**
 * Overlay DWD-MOSMIX ab Tag 6 (Index 5*24). MOSMIX ist eine deterministische,
 * statistisch nachkalibrierte Punktprognose auf ICON-Basis — saubere Naht zu
 * icon_seamless ohne Modellsprung zu einem Ensemble-Mittel.
 */
function applyMosmixOverlay(
  forecast: ForecastResponse,
  mosmix: MosmixHourly | null,
  offsetSec: number,
): ForecastResponse {
  if (!mosmix) return forecast;
  const aligned = alignMosmixToTimeline(mosmix, forecast.hourly.time, offsetSec, 5 * 24);
  if (!aligned) return forecast;
  const merged = overwriteFromIndex(forecast, aligned, 5 * 24);
  // Daily aus dem überschriebenen Hourly neu aggregieren.
  for (let i = 0; i < merged.daily.time.length; i++) {
    const agg = aggregateDailyFromHourly(merged.hourly, merged.daily.time[i] ?? "");
    const wc = agg.weathercode;
    if (typeof wc === "number" && Number.isFinite(wc)) merged.daily.weathercode[i] = wc;
    const ps = agg.precipitation_sum;
    if (typeof ps === "number" && Number.isFinite(ps)) merged.daily.precipitation_sum[i] = ps;
    const ph = agg.precipitation_hours;
    if (typeof ph === "number" && Number.isFinite(ph)) merged.daily.precipitation_hours[i] = ph;
    const sd = agg.sunshine_duration;
    if (typeof sd === "number" && Number.isFinite(sd)) merged.daily.sunshine_duration[i] = sd;
  }
  return merged;
}


function setCdnCacheHeaders() {
  setResponseHeaders(
    new Headers({
      "Cache-Control":
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    }),
  );
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
    setCdnCacheHeaders();
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

/**
 * Batch-Variante: liest den Symbol-Cache **einmal** und liefert die Prognose
 * pro übergebenem Punkt. So macht die Region-Karte 1 RPC statt N.
 */
export const getAggregatedForecastBatch = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      points: { id: string; lat: number; lon: number }[];
      v?: string | number;
    }) => {
      if (!Array.isArray(input?.points) || input.points.length === 0) {
        throw new Error("points required");
      }
      const points = input.points.slice(0, 32).map((p) => {
        if (
          typeof p?.id !== "string" ||
          typeof p?.lat !== "number" ||
          typeof p?.lon !== "number"
        ) {
          throw new Error("invalid point");
        }
        return {
          id: p.id,
          lat: Math.round(p.lat * 10_000) / 10_000,
          lon: Math.round(p.lon * 10_000) / 10_000,
        };
      });
      return { points, v: input?.v != null ? String(input.v) : undefined };
    },
  )
  .handler(
    async ({ data }): Promise<Record<string, ForecastResponse>> => {
      setCdnCacheHeaders();
      const out: Record<string, ForecastResponse> = {};
      let locs: Loc[] | null = null;
      try {
        locs = await loadSymbolLocs();
      } catch (err) {
        console.error("[aggregated-forecast-batch] cache read failed", err);
      }

      for (const p of data.points) {
        if (locs) {
          const best = pickNearest(locs, p.lat, p.lon);
          if (best?.hourly?.time?.length) {
            out[p.id] = buildForecastFromCacheLoc(best);
            continue;
          }
        }
        try {
          out[p.id] = await fetchForecast(p.lat, p.lon);
        } catch (err) {
          console.error("[aggregated-forecast-batch] direct fail", p.id, err);
          out[p.id] = emptyForecast(p.lat, p.lon);
        }
      }
      return out;
    },
  );
