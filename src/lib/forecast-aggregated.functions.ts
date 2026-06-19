import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import {
  fetchForecast,
  sanitizeForecast,
  aggregateDailyFromHourly,
  alignMosmixToTimeline,
  computeSunTimesLocal,
  overwriteFromIndex,
  type DailyData,
  type ForecastResponse,
  type HourlyData,
} from "./weather";
import { fetchMosmix, type MosmixHourly } from "./mosmix.functions";
import {
  getMchLocalForecastCache,
  getSymbolCache,
  type MchLocalForecastLocation,
} from "./openmeteo-cache.server";

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

  // Daily-Felder vollständig aus dem gemergten Hourly nach-aggregieren —
  // inkl. Wind/Böen/NS-Wahrscheinlichkeit; Sonnenzeiten ggf. astronomisch.
  const fc: ForecastResponse = {
    latitude: loc.latitude ?? 0,
    longitude: loc.longitude ?? 0,
    timezone: loc.timezone ?? "Europe/Zurich",
    hourly,
    daily,
  };
  enrichDailyFromHourly(
    fc,
    loc.latitude ?? 0,
    loc.longitude ?? 0,
    loc.utc_offset_seconds ?? 0,
  );

  return sanitizeForecast(fc);
}

async function loadSymbolLocs(): Promise<Loc[] | null> {
  const cache = await getSymbolCache();
  const locs = cache?.phaseA as Loc[] | undefined;
  return locs?.length ? locs : null;
}

/** Numerischer Cleaner: null/undefined/NaN → 0, sonst Zahl. */
function num(v: number | null | undefined, fill = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fill;
}

/**
 * Re-Aggregation aller Tagesfelder aus dem (gemergten) Hourly inkl.
 * Wind/Böen/Richtung/NS-Wahrscheinlichkeit. Lückenhafte Sonnenauf-/
 * Sonnenuntergangs-Zeiten (Primärquelle MCH liefert sie nicht) werden
 * astronomisch berechnet.
 */
function enrichDailyFromHourly(
  fc: ForecastResponse,
  lat: number,
  lon: number,
  offsetSec: number,
): void {
  const d = fc.daily;
  for (let i = 0; i < d.time.length; i++) {
    const agg = aggregateDailyFromHourly(fc.hourly, d.time[i] ?? "");
    const apply = (key: keyof DailyData) => {
      const v = agg[key as string];
      if (typeof v === "number" && Number.isFinite(v)) {
        (d[key] as number[])[i] = v as number;
      }
    };
    apply("weathercode");
    apply("precipitation_sum");
    apply("precipitation_hours");
    apply("precipitation_probability_max");
    apply("windspeed_10m_max");
    apply("windgusts_10m_max");
    apply("winddirection_10m_dominant");
    apply("sunshine_duration");
    apply("snowfall_sum");
    // Sonnenauf/-untergang astronomisch ergänzen, wenn Quelle nichts liefert.
    if (!d.sunrise[i] || !d.sunset[i]) {
      const s = computeSunTimesLocal(lat, lon, d.time[i] ?? "", offsetSec);
      if (!d.sunrise[i] && s.sunrise) d.sunrise[i] = s.sunrise;
      if (!d.sunset[i] && s.sunset) d.sunset[i] = s.sunset;
    }
  }
}


function pickNearestMch(
  locs: MchLocalForecastLocation[],
  lat: number,
  lon: number,
): MchLocalForecastLocation | null {
  let best: MchLocalForecastLocation | null = null;
  let bestD = Infinity;
  for (const l of locs) {
    const dLat = lat - l.latitude;
    const dLon = lon - l.longitude;
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

/**
 * Baut aus einem MCH-Local-Forecast-Eintrag eine ForecastResponse im
 * Open-Meteo-Schema. Daily-Aggregate (Wind/Sonne/Niederschlagsstunden/
 * Symbol) werden aus dem Hourly nach-aggregiert — analog zur phaseA-Branch.
 *
 * Achtung: Felder, die MCH-STAC oft nicht liefert (rre150h0/Niederschlag,
 * Schneefall, Niederschlagswahrscheinlichkeit), werden als NaN gehalten —
 * damit `aggregateDailyFromHourly` sie aus der Tagessumme ausklammert und
 * der korrekte MCH-Tageswert (rka150p0) nicht durch eine künstliche 0
 * überschrieben wird. Die Lücken füllt anschließend `overlayHourlyFromOpenMeteo`.
 */
function buildForecastFromMchLoc(loc: MchLocalForecastLocation): ForecastResponse {
  const h = loc.hourly;
  const hLen = h.time.length;
  const hourly: HourlyData = {
    time: h.time.slice(),
    weathercode: h.weathercode.map((v) => num(v, 3)),
    temperature_2m: h.temperature_2m.map((v) => num(v)),
    precipitation: h.precipitation.map((v) => num(v, NaN)),
    precipitation_probability: h.precipitation_probability.map((v) => num(v, NaN)),
    windspeed_10m: h.windspeed_10m.map((v) => num(v)),
    windgusts_10m: h.windgusts_10m.map((v) => num(v)),
    winddirection_10m: h.winddirection_10m.map((v) => num(v)),
    snowfall: h.snowfall.map((v) => num(v, NaN)),
    sunshine_duration: h.sunshine_duration.map((v) => num(v)),
    cloud_cover_low: h.cloud_cover_low.map((v) => num(v)),
    cloud_cover_mid: h.cloud_cover_mid.map((v) => num(v)),
    cloud_cover_high: h.cloud_cover_high.map((v) => num(v)),
  };
  if (h.weathercode_mch) {
    hourly.weathercode_mch = h.weathercode_mch.map((v) =>
      typeof v === "number" && Number.isFinite(v) ? v : NaN,
    );
  }
  if (hourly.time.length !== hLen) hourly.time = hourly.time.slice(0, hLen);

  const d = loc.daily;
  const dLen = d.time.length;
  const daily: DailyData = {
    time: d.time.slice(),
    weathercode: d.weathercode.map((v) => num(v, 3)),
    temperature_2m_max: d.temperature_2m_max.map((v) => num(v)),
    temperature_2m_min: d.temperature_2m_min.map((v) => num(v)),
    precipitation_sum: d.precipitation_sum.map((v) => num(v)),
    precipitation_probability_max: new Array(dLen).fill(0),
    windspeed_10m_max: new Array(dLen).fill(0),
    windgusts_10m_max: new Array(dLen).fill(0),
    winddirection_10m_dominant: new Array(dLen).fill(0),
    sunshine_duration: new Array(dLen).fill(0),
    sunrise: new Array(dLen).fill(""),
    sunset: new Array(dLen).fill(""),
    snowfall_sum: new Array(dLen).fill(0),
    precipitation_hours: new Array(dLen).fill(0),
  };

  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    timezone: loc.timezone ?? "Europe/Zurich",
    hourly,
    daily,
  };
}

/**
 * Füllt fehlende Stunden-Niederschlagswerte (mm, Wahrscheinlichkeit, Schnee)
 * aus dem Open-Meteo-phaseA-Cache nach. MCH-STAC liefert oft nur die Tages-
 * summe; ohne diesen Overlay bleiben die Regenbalken in den Tageskacheln leer.
 */
function overlayHourlyFromOpenMeteo(fc: ForecastResponse, omLoc: Loc | null): void {
  if (!omLoc?.hourly) return;
  const om = buildForecastFromCacheLoc(omLoc);
  const idx = new Map<string, number>();
  for (let i = 0; i < om.hourly.time.length; i++) idx.set(om.hourly.time[i], i);
  const h = fc.hourly;
  const fillIfMissing = (target: number[], src: number[]) => {
    for (let i = 0; i < h.time.length; i++) {
      const cur = target[i];
      if (typeof cur === "number" && Number.isFinite(cur)) continue;
      const j = idx.get(h.time[i]);
      if (j == null) continue;
      const s = src[j];
      if (typeof s === "number" && Number.isFinite(s)) target[i] = s;
    }
  };
  fillIfMissing(h.precipitation, om.hourly.precipitation);
  fillIfMissing(h.precipitation_probability, om.hourly.precipitation_probability);
  fillIfMissing(h.snowfall, om.hourly.snowfall);
}

/**
 * Versucht eine MCH-local-forecast-basierte Prognose für (lat,lon) zu
 * bauen. Gibt `null` zurück, wenn der MCH-Cache fehlt oder der nächste
 * Punkt eine leere Zeitreihe hat (z. B. STAC-Item ohne Asset).
 */
async function forecastFromMchCache(
  lat: number,
  lon: number,
  mchLocs: MchLocalForecastLocation[],
  omLocs: Loc[] | null,
): Promise<{ fc: ForecastResponse; loc: MchLocalForecastLocation } | null> {
  const best = pickNearestMch(mchLocs, lat, lon);
  if (!best?.hourly?.time?.length) return null;
  const fc = buildForecastFromMchLoc(best);
  const omLoc = omLocs ? pickNearest(omLocs, lat, lon) : null;
  overlayHourlyFromOpenMeteo(fc, omLoc);
  enrichDailyFromHourly(fc, best.latitude, best.longitude, best.utc_offset_seconds ?? 0);
  return { fc: sanitizeForecast(fc), loc: best };
}


async function forecastFromCache(
  lat: number,
  lon: number,
): Promise<ForecastResponse | null> {
  const locs = await loadSymbolLocs();
  if (!locs) return null;
  const best = pickNearest(locs, lat, lon);
  if (!best?.hourly?.time?.length) return null;
  const fc = buildForecastFromCacheLoc(best);
  const mosmix = await fetchMosmix({ data: { latitude: lat, longitude: lon } }).catch(
    (e) => {
      console.warn("[aggregated-forecast] MOSMIX nicht verfügbar:", e);
      return null;
    },
  );
  return applyMosmixOverlay(fc, mosmix, best.utc_offset_seconds ?? 0);
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
  // Daily ab Tag 6 vollständig aus überschriebenem Hourly neu aggregieren
  // (inkl. Wind/Böen/Probability); Sonnenzeiten astronomisch ergänzen.
  enrichDailyFromHourly(merged, forecast.latitude, forecast.longitude, offsetSec);
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

    // 1) Primärquelle: MCH OGD local_forecast.
    try {
      const mch = await getMchLocalForecastCache();
      if (mch?.locations?.length) {
        const omLocs = await loadSymbolLocs().catch(() => null);
        const built = await forecastFromMchCache(data.lat, data.lon, mch.locations, omLocs);
        if (built) {
          const mosmix = await fetchMosmix({
            data: { latitude: data.lat, longitude: data.lon },
          }).catch((e) => {
            console.warn("[aggregated-forecast] MOSMIX nicht verfügbar:", e);
            return null;
          });
          return applyMosmixOverlay(built.fc, mosmix, built.loc.utc_offset_seconds ?? 0);
        }
      }
    } catch (err) {
      console.error("[aggregated-forecast] MCH cache read failed", err);
    }

    // 2) Fallback: alter phaseA-Cache (Open-Meteo Multi-Modell).
    try {
      const cached = await forecastFromCache(data.lat, data.lon);
      if (cached) return cached;
    } catch (err) {
      console.error("[aggregated-forecast] phaseA cache read failed", err);
    }

    // 3) Last Resort: direkter Open-Meteo-Call.
    console.warn(
      "[aggregated-forecast] all caches missed for",
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

      // Beide Caches einmal lesen — MCH primär, phaseA als Fallback pro Punkt.
      let mchLocs: MchLocalForecastLocation[] | null = null;
      let locs: Loc[] | null = null;
      try {
        const mch = await getMchLocalForecastCache();
        mchLocs = mch?.locations?.length ? mch.locations : null;
      } catch (err) {
        console.error("[aggregated-forecast-batch] MCH cache read failed", err);
      }
      try {
        locs = await loadSymbolLocs();
      } catch (err) {
        console.error("[aggregated-forecast-batch] phaseA cache read failed", err);
      }

      // MOSMIX dedupliziert pro Punkt holen.
      const mosmixCache = new Map<string, Promise<MosmixHourly | null>>();
      const getMosmix = (lat: number, lon: number) => {
        const key = `${lat.toFixed(2)}|${lon.toFixed(2)}`;
        let p = mosmixCache.get(key);
        if (!p) {
          p = fetchMosmix({ data: { latitude: lat, longitude: lon } }).catch((e) => {
            console.warn("[aggregated-forecast-batch] MOSMIX nicht verfügbar:", e);
            return null;
          });
          mosmixCache.set(key, p);
        }
        return p;
      };

      for (const p of data.points) {
        // 1) MCH primär
        if (mchLocs) {
          const built = await forecastFromMchCache(p.lat, p.lon, mchLocs, locs);
          if (built) {
            const mosmix = await getMosmix(p.lat, p.lon);
            out[p.id] = applyMosmixOverlay(
              built.fc,
              mosmix,
              built.loc.utc_offset_seconds ?? 0,
            );
            continue;
          }
        }
        // 2) phaseA fallback
        if (locs) {
          const best = pickNearest(locs, p.lat, p.lon);
          if (best?.hourly?.time?.length) {
            const fc = buildForecastFromCacheLoc(best);
            const mosmix = await getMosmix(p.lat, p.lon);
            out[p.id] = applyMosmixOverlay(fc, mosmix, best.utc_offset_seconds ?? 0);
            continue;
          }
        }
        // 3) Direkter Open-Meteo-Call als letzte Reissleine
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

