// Open-Meteo client-side fetchers (ICON-CH2 / MeteoSchweiz model).
// CORS-enabled, no API key required.

export interface GeoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country_code?: string;
  postcodes?: string[];
}

export interface DailyData {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  windspeed_10m_max: number[];
  windgusts_10m_max: number[];
  winddirection_10m_dominant: number[];
  sunshine_duration: number[];
  sunrise: string[];
  sunset: string[];
  snowfall_sum: number[];
}

export interface HourlyData {
  time: string[];
  weathercode: number[];
  temperature_2m: number[];
  precipitation: number[];
  precipitation_probability: number[];
  windspeed_10m: number[];
  windgusts_10m: number[];
  winddirection_10m: number[];
  snowfall: number[];
  sunshine_duration: number[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: DailyData;
  hourly: HourlyData;
  generationtime_ms?: number;
}

export async function searchLocations(query: string): Promise<GeoLocation[]> {
  if (!query.trim()) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "CH");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Geocoding fehlgeschlagen");
  const data = await res.json();
  return (data.results ?? []) as GeoLocation[];
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("language", "de");
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const first = data?.results?.[0];
      if (first?.name) return first.name as string;
    }
  } catch {
    /* ignore */
  }
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

const DAILY_VARS = [
  "weathercode",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "windspeed_10m_max",
  "windgusts_10m_max",
  "winddirection_10m_dominant",
  "sunshine_duration",
  "sunrise",
  "sunset",
  "snowfall_sum",
] as const;

const HOURLY_VARS = [
  "weathercode",
  "temperature_2m",
  "precipitation",
  "precipitation_probability",
  "windspeed_10m",
  "windgusts_10m",
  "winddirection_10m",
  "snowfall",
  "sunshine_duration",
] as const;

const TOTAL_DAYS = 7;

async function fetchModel(
  latitude: number,
  longitude: number,
  model: string,
): Promise<ForecastResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("models", model);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(TOTAL_DAYS));
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("daily", DAILY_VARS.join(","));
  url.searchParams.set("hourly", HOURLY_VARS.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Modell ${model} nicht erreichbar`);
  return (await res.json()) as ForecastResponse;
}

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v));
}

/** Lückenfüller: nur fehlende Einträge in primary werden aus fallback ersetzt. */
function fillGaps(
  primary: ForecastResponse,
  fallback: ForecastResponse,
): ForecastResponse {
  const mergeArr = <T>(p: T[] | undefined, f: T[] | undefined): T[] => {
    const pa = p ?? [];
    const fa = f ?? [];
    const len = Math.max(pa.length, fa.length);
    const out: T[] = new Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = isMissing(pa[i]) ? fa[i] : pa[i];
    }
    return out;
  };

  const mergeTime = (p: string[] | undefined, f: string[] | undefined): string[] => {
    const pa = p ?? [];
    const fa = f ?? [];
    if (fa.length <= pa.length) return pa;
    return [...pa, ...fa.slice(pa.length)];
  };

  const h = primary.hourly;
  const fh = fallback.hourly;
  const d = primary.daily;
  const fd = fallback.daily;

  const mergedHourly: HourlyData = {
    time: mergeTime(h?.time, fh?.time),
    weathercode: mergeArr(h?.weathercode, fh?.weathercode),
    temperature_2m: mergeArr(h?.temperature_2m, fh?.temperature_2m),
    precipitation: mergeArr(h?.precipitation, fh?.precipitation),
    precipitation_probability: mergeArr(
      h?.precipitation_probability,
      fh?.precipitation_probability,
    ),
    windspeed_10m: mergeArr(h?.windspeed_10m, fh?.windspeed_10m),
    windgusts_10m: mergeArr(h?.windgusts_10m, fh?.windgusts_10m),
    winddirection_10m: mergeArr(h?.winddirection_10m, fh?.winddirection_10m),
    snowfall: mergeArr(h?.snowfall, fh?.snowfall),
    sunshine_duration: mergeArr(h?.sunshine_duration, fh?.sunshine_duration),
  };

  const mergedDaily: DailyData = {
    time: mergeTime(d?.time, fd?.time),
    weathercode: mergeArr(d?.weathercode, fd?.weathercode),
    temperature_2m_max: mergeArr(d?.temperature_2m_max, fd?.temperature_2m_max),
    temperature_2m_min: mergeArr(d?.temperature_2m_min, fd?.temperature_2m_min),
    precipitation_sum: mergeArr(d?.precipitation_sum, fd?.precipitation_sum),
    precipitation_probability_max: mergeArr(
      d?.precipitation_probability_max,
      fd?.precipitation_probability_max,
    ),
    windspeed_10m_max: mergeArr(d?.windspeed_10m_max, fd?.windspeed_10m_max),
    windgusts_10m_max: mergeArr(d?.windgusts_10m_max, fd?.windgusts_10m_max),
    winddirection_10m_dominant: mergeArr(
      d?.winddirection_10m_dominant,
      fd?.winddirection_10m_dominant,
    ),
    sunshine_duration: mergeArr(d?.sunshine_duration, fd?.sunshine_duration),
    sunrise: mergeArr(d?.sunrise, fd?.sunrise),
    sunset: mergeArr(d?.sunset, fd?.sunset),
    snowfall_sum: mergeArr(d?.snowfall_sum, fd?.snowfall_sum),
  };

  return { ...primary, hourly: mergedHourly, daily: mergedDaily };
}

const ENSEMBLE_HOURLY_VARS = [
  "weathercode",
  "temperature_2m",
  "precipitation",
  "windspeed_10m",
  "windgusts_10m",
  "winddirection_10m",
  "snowfall",
  "sunshine_duration",
] as const;

type EnsembleHourly = Partial<HourlyData> & { time: string[]; utc_offset_seconds?: number };

type EnsembleModel = "meteoswiss_icon_ch1" | "meteoswiss_icon_ch2" | "ecmwf_ifs025";

const ENSEMBLE_DAYS: Record<EnsembleModel, number> = {
  meteoswiss_icon_ch1: 2,
  meteoswiss_icon_ch2: 5,
  ecmwf_ifs025: 7,
};

function sliceEnsembleHourly(ens: EnsembleHourly, maxHours: number): EnsembleHourly {
  const out: EnsembleHourly = { time: ens.time.slice(0, maxHours) };
  for (const key of Object.keys(ens)) {
    if (key === "time") continue;
    const arr = (ens as Record<string, unknown>)[key];
    if (Array.isArray(arr)) {
      (out as Record<string, unknown>)[key] = (arr as number[]).slice(0, maxHours);
    }
  }
  return out;
}

async function fetchEnsembleMean(
  latitude: number,
  longitude: number,
  model: EnsembleModel,
): Promise<EnsembleHourly> {
  const url = new URL("https://ensemble-api.open-meteo.com/v1/ensemble");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("models", model);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(ENSEMBLE_DAYS[model]));
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("hourly", ENSEMBLE_HOURLY_VARS.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Ensemble ${model} nicht erreichbar`);
  const data = (await res.json()) as { hourly?: Record<string, unknown>; utc_offset_seconds?: number };
  const h = data.hourly ?? {};
  const time = (h.time as string[] | undefined) ?? [];
  const out: EnsembleHourly = { time, utc_offset_seconds: data.utc_offset_seconds };
  for (const v of ENSEMBLE_HOURLY_VARS) {
    const series: number[][] = [];
    for (const key of Object.keys(h)) {
      if (key === v || key.startsWith(`${v}_member`)) {
        const arr = h[key];
        if (Array.isArray(arr)) series.push(arr as number[]);
      }
    }
    if (series.length === 0) continue;
    const mean: number[] = new Array(time.length);
    for (let i = 0; i < time.length; i++) {
      let sum = 0;
      let count = 0;
      for (const s of series) {
        const x = s[i];
        if (typeof x === "number" && Number.isFinite(x)) {
          sum += x;
          count++;
        }
      }
      mean[i] = count > 0 ? (v === "weathercode" ? Math.round(sum / count) : sum / count) : (NaN as number);
    }
    (out as Record<string, unknown>)[v] = mean;
  }
  return out;
}

function wrapEnsembleAsForecast(ens: EnsembleHourly): ForecastResponse {
  const empty: HourlyData = {
    time: ens.time,
    weathercode: (ens.weathercode ?? []) as number[],
    temperature_2m: (ens.temperature_2m ?? []) as number[],
    precipitation: (ens.precipitation ?? []) as number[],
    precipitation_probability: [],
    windspeed_10m: (ens.windspeed_10m ?? []) as number[],
    windgusts_10m: (ens.windgusts_10m ?? []) as number[],
    winddirection_10m: (ens.winddirection_10m ?? []) as number[],
    snowfall: (ens.snowfall ?? []) as number[],
    sunshine_duration: (ens.sunshine_duration ?? []) as number[],
  };
  const emptyDaily: DailyData = {
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
  };
  return { latitude: 0, longitude: 0, timezone: "", hourly: empty, daily: emptyDaily };
}

function aggregateDailyFromHourly(h: HourlyData, dayIso: string) {
  const day = dayIso.slice(0, 10);
  const idxs: number[] = [];
  for (let i = 0; i < h.time.length; i++) {
    if ((h.time[i] ?? "").slice(0, 10) === day) idxs.push(i);
  }
  if (idxs.length === 0) return {} as Record<string, number | null>;
  const finite = (arr: number[] | undefined): number[] =>
    idxs
      .map((i) => arr?.[i])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const max = (a: number[]) => (a.length ? Math.max(...a) : null);
  const min = (a: number[]) => (a.length ? Math.min(...a) : null);
  const sum = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) : null);
  const median = (a: number[]) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const dirs = finite(h.winddirection_10m);
  const speeds = finite(h.windspeed_10m);
  let dominantDir: number | null = null;
  if (dirs.length) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < dirs.length; k++) {
      const w = speeds[k] ?? 1;
      const rad = (dirs[k] * Math.PI) / 180;
      x += Math.cos(rad) * w;
      y += Math.sin(rad) * w;
    }
    dominantDir = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  return {
    weathercode: median(finite(h.weathercode)),
    temperature_2m_max: max(finite(h.temperature_2m)),
    temperature_2m_min: min(finite(h.temperature_2m)),
    precipitation_sum: sum(finite(h.precipitation)),
    windspeed_10m_max: max(finite(h.windspeed_10m)),
    windgusts_10m_max: max(finite(h.windgusts_10m)),
    winddirection_10m_dominant: dominantDir,
    sunshine_duration: sum(finite(h.sunshine_duration)),
    snowfall_sum: sum(finite(h.snowfall)),
  } as Record<string, number | null>;
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastResponse> {
  // ICON-CH1-EPS für Stunden 0–24, danach ICON-CH2-EPS (bis Tag 5),
  // danach ECMWF IFS Ensemble (bis Tag 7). best_match nur als Restfallback
  // für Felder, die Ensembles nicht liefern (Probability, Sunrise/Sunset).
  const [ch1RawFull, ch2Raw, ifsRaw, bestMatch] = await Promise.all([
    fetchEnsembleMean(latitude, longitude, "meteoswiss_icon_ch1").catch(() => null),
    fetchEnsembleMean(latitude, longitude, "meteoswiss_icon_ch2").catch(() => null),
    fetchEnsembleMean(latitude, longitude, "ecmwf_ifs025").catch(() => null),
    fetchModel(latitude, longitude, "best_match").catch(() => null),
  ]);

  const ch1Raw = ch1RawFull ? sliceEnsembleHourly(ch1RawFull, 24) : null;

  // Primärquelle ist CH1 (0-24h); falls nicht verfügbar, nimm CH2 → IFS → best_match.
  type PrimarySource = "ch1" | "ch2" | "ifs" | "best_match";
  let primary: ForecastResponse | null = null;
  let primarySource: PrimarySource | null = null;
  if (ch1Raw) { primary = wrapEnsembleAsForecast(ch1Raw); primarySource = "ch1"; }
  else if (ch2Raw) { primary = wrapEnsembleAsForecast(ch2Raw); primarySource = "ch2"; }
  else if (ifsRaw) { primary = wrapEnsembleAsForecast(ifsRaw); primarySource = "ifs"; }
  else if (bestMatch) { primary = bestMatch; primarySource = "best_match"; }
  if (!primary) throw new Error("Keine Wettermodelle erreichbar");

  let merged = primary;
  if (ch2Raw && primarySource !== "ch2") merged = fillGaps(merged, wrapEnsembleAsForecast(ch2Raw));
  if (ifsRaw && primarySource !== "ifs") merged = fillGaps(merged, wrapEnsembleAsForecast(ifsRaw));
  if (bestMatch && primarySource !== "best_match") merged = fillGaps(merged, bestMatch);

  // Daily-Werte aus den gemergten Hourly-Arrays neu aggregieren (Ensembles liefern keine Daily-Felder).
  // Sunrise/Sunset/Probability bleiben aus best_match (via fillGaps schon übernommen).
  const daysFromHourly = new Set<string>();
  for (const t of merged.hourly.time) daysFromHourly.add((t ?? "").slice(0, 10));
  const dailyTimes = merged.daily.time.length
    ? merged.daily.time
    : Array.from(daysFromHourly).slice(0, TOTAL_DAYS);

  if (!merged.daily.time.length) {
    merged.daily.time = dailyTimes;
  }

  const ensureLen = (key: keyof DailyData) => {
    const arr = merged.daily[key] as (number | string)[];
    while (arr.length < dailyTimes.length) arr.push(0 as never);
  };
  (["weathercode","temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","windspeed_10m_max","windgusts_10m_max","winddirection_10m_dominant","sunshine_duration","snowfall_sum"] as (keyof DailyData)[])
    .forEach(ensureLen);

  for (let i = 0; i < dailyTimes.length; i++) {
    const agg = aggregateDailyFromHourly(merged.hourly, dailyTimes[i]);
    const apply = (key: keyof DailyData) => {
      const v = agg[key as string];
      if (v != null && Number.isFinite(v)) {
        (merged.daily[key] as (number | string)[])[i] = v as number;
      }
    };
    apply("weathercode");
    apply("temperature_2m_max");
    apply("temperature_2m_min");
    apply("precipitation_sum");
    apply("windspeed_10m_max");
    apply("windgusts_10m_max");
    apply("winddirection_10m_dominant");
    apply("sunshine_duration");
    apply("snowfall_sum");
  }

  return sanitizeForecast(merged);
}



function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizeForecast(data: ForecastResponse): ForecastResponse {
  const h = data.hourly;
  const d = data.daily;

  const fixNumArr = (arr: (number | null)[] | undefined, fallback = 0) =>
    (arr ?? []).map((v) => num(v, fallback));

  const sanitizedHourly: HourlyData = {
    time: h?.time ?? [],
    weathercode: fixNumArr(h?.weathercode as (number | null)[]),
    temperature_2m: fixNumArr(h?.temperature_2m as (number | null)[]),
    precipitation: fixNumArr(h?.precipitation as (number | null)[]),
    precipitation_probability: fixNumArr(
      h?.precipitation_probability as (number | null)[],
    ),
    windspeed_10m: fixNumArr(h?.windspeed_10m as (number | null)[]),
    windgusts_10m: fixNumArr(h?.windgusts_10m as (number | null)[]),
    winddirection_10m: fixNumArr(h?.winddirection_10m as (number | null)[]),
    snowfall: fixNumArr(h?.snowfall as (number | null)[]),
    sunshine_duration: fixNumArr(h?.sunshine_duration as (number | null)[]),
  };

  const sanitizedDaily: DailyData = {
    time: d?.time ?? [],
    weathercode: fixNumArr(d?.weathercode as (number | null)[]),
    temperature_2m_max: fixNumArr(d?.temperature_2m_max as (number | null)[]),
    temperature_2m_min: fixNumArr(d?.temperature_2m_min as (number | null)[]),
    precipitation_sum: fixNumArr(d?.precipitation_sum as (number | null)[]),
    precipitation_probability_max: fixNumArr(
      d?.precipitation_probability_max as (number | null)[],
    ),
    windspeed_10m_max: fixNumArr(d?.windspeed_10m_max as (number | null)[]),
    windgusts_10m_max: fixNumArr(d?.windgusts_10m_max as (number | null)[]),
    winddirection_10m_dominant: fixNumArr(
      d?.winddirection_10m_dominant as (number | null)[],
    ),
    sunshine_duration: fixNumArr(d?.sunshine_duration as (number | null)[]),
    sunrise: (d?.sunrise ?? []).map((v) => v ?? ""),
    sunset: (d?.sunset ?? []).map((v) => v ?? ""),
    snowfall_sum: fixNumArr(d?.snowfall_sum as (number | null)[]),
  };

  return {
    ...data,
    hourly: sanitizedHourly,
    daily: sanitizedDaily,
  };
}

// WMO weather code → emoji (day variant)
export function weatherSymbol(code: number, isDay = true): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code === 1) return isDay ? "🌤️" : "🌙";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code === 80 || code === 81) return "🌦️";
  if (code === 82) return "🌧️";
  if (code === 85 || code === 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "·";
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Klar";
  if (code <= 2) return "Heiter";
  if (code === 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code <= 57) return "Nieselregen";
  if (code <= 67) return "Regen";
  if (code <= 77) return "Schnee";
  if (code <= 82) return "Regenschauer";
  if (code <= 86) return "Schneeschauer";
  return "Gewitter";
}

export function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return dirs[Math.round((deg % 360) / 45) % 8];
}

const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_LONG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export function weekdayShort(date: Date): string {
  return WEEKDAYS_SHORT[date.getDay()];
}
export function weekdayLong(date: Date): string {
  return WEEKDAYS_LONG[date.getDay()];
}
export function formatDateShort(date: Date): string {
  return `${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}
export function formatTimeHHMM(iso: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function secondsToHours(sec: number): string {
  return (sec / 3600).toFixed(1);
}
