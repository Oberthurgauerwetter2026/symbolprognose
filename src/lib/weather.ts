// Open-Meteo client-side fetchers (ICON-CH2 / MeteoSchweiz model).
// CORS-enabled, no API key required. DWD-MOSMIX wird via Server Function dazugemerged.
import { fetchMosmix, type MosmixHourly } from "./mosmix.functions";

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
  precipitation_hours: number[];
  thunderstorm_hours?: number[];
  cloud_cover_low_mean?: number[];
  cloud_cover_mid_mean?: number[];
  cloud_cover_high_mean?: number[];
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
  cloud_cover_low?: number[];
  cloud_cover_mid?: number[];
  cloud_cover_high?: number[];
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
  // 1) Open-Meteo
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
  // 2) Nominatim Fallback
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "12");
    url.searchParams.set("accept-language", "de");
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const a = data?.address ?? {};
      const name =
        a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.county;
      if (name) return String(name);
    }
  } catch {
    /* ignore */
  }
  return "Aktueller Standort";
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
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
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
    cloud_cover_low: mergeArr(h?.cloud_cover_low, fh?.cloud_cover_low),
    cloud_cover_mid: mergeArr(h?.cloud_cover_mid, fh?.cloud_cover_mid),
    cloud_cover_high: mergeArr(h?.cloud_cover_high, fh?.cloud_cover_high),
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
    precipitation_hours: mergeArr(d?.precipitation_hours, fd?.precipitation_hours),
  };

  return { ...primary, hourly: mergedHourly, daily: mergedDaily };
}

/**
 * Überschreibt ab `fromIndex` alle finiten Werte in `primary.hourly` mit denen
 * aus `source.hourly`. Lücken (NaN) in `source` lassen `primary` unverändert.
 * Daily bleibt unberührt (wird später aus dem neuen Hourly aggregiert).
 */
function overwriteFromIndex(
  primary: ForecastResponse,
  source: ForecastResponse,
  fromIndex: number,
): ForecastResponse {
  const keys: (keyof HourlyData)[] = [
    "weathercode",
    "temperature_2m",
    "precipitation",
    "precipitation_probability",
    "windspeed_10m",
    "windgusts_10m",
    "winddirection_10m",
    "snowfall",
    "sunshine_duration",
  ];
  const ph = primary.hourly;
  const sh = source.hourly;
  const n = Math.min(ph.time.length, sh.time.length);
  const outHourly: HourlyData = {
    ...ph,
    weathercode: [...ph.weathercode],
    temperature_2m: [...ph.temperature_2m],
    precipitation: [...ph.precipitation],
    precipitation_probability: [...ph.precipitation_probability],
    windspeed_10m: [...ph.windspeed_10m],
    windgusts_10m: [...ph.windgusts_10m],
    winddirection_10m: [...ph.winddirection_10m],
    snowfall: [...ph.snowfall],
    sunshine_duration: [...ph.sunshine_duration],
  };
  for (let i = fromIndex; i < n; i++) {
    for (const k of keys) {
      const v = (sh[k] as number[])[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        (outHourly[k] as number[])[i] = v;
      }
    }
  }
  return { ...primary, hourly: outHourly };
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
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
] as const;

type EnsembleHourly = Partial<HourlyData> & { time: string[]; utc_offset_seconds?: number };

type EnsembleModel = "ecmwf_ifs025";

const ENSEMBLE_DAYS: Record<EnsembleModel, number> = {
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

// WMO-Code → Kategorie (höher = "nasser/schwerer", für Tie-Break).
function wmoCategory(code: number): number {
  if (code >= 95) return 9;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 8;
  if ((code >= 61 && code <= 67) || code === 82) return 7;
  if (code === 80 || code === 81) return 6;
  if (code >= 51 && code <= 57) return 5;
  if (code === 45 || code === 48) return 4;
  if (code === 3) return 3;
  if (code === 2) return 2;
  if (code === 1) return 1;
  return 0;
}

// Kategorialer Modus statt arithmetisches Mittel/Median für WMO-Codes.
function representativeWeathercode(
  codes: number[],
  opts?: { preferShower?: boolean },
): number | null {
  const valid = codes.filter((c) => typeof c === "number" && Number.isFinite(c));
  if (!valid.length) return null;
  const catCount = new Map<number, number>();
  const codeCount = new Map<number, number>();
  for (const c of valid) {
    const cat = wmoCategory(c);
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    codeCount.set(c, (codeCount.get(c) ?? 0) + 1);
  }
  let bestCat = -1;
  let bestCount = -1;
  for (const [cat, n] of catCount) {
    if (n > bestCount || (n === bestCount && cat > bestCat)) {
      bestCat = cat;
      bestCount = n;
    }
  }
  // Schauer-vor-Regen-Override (Daily, wenn precipHours < 8h).
  if (opts?.preferShower && bestCat === 7) {
    const showerN = catCount.get(6) ?? 0;
    if (showerN >= bestCount - 1) bestCat = 6;
  }
  let bestCode = valid[0];
  let bestN = -1;
  for (const [c, n] of codeCount) {
    if (wmoCategory(c) !== bestCat) continue;
    if (n > bestN) {
      bestCode = c;
      bestN = n;
    }
  }
  return bestCode;
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
      if (v === "weathercode") {
        const codes: number[] = [];
        for (const s of series) {
          const x = s[i];
          if (typeof x === "number" && Number.isFinite(x)) codes.push(x);
        }
        const rep = representativeWeathercode(codes);
        mean[i] = rep ?? (NaN as number);
        continue;
      }
      let sum = 0;
      let count = 0;
      for (const s of series) {
        const x = s[i];
        if (typeof x === "number" && Number.isFinite(x)) {
          sum += x;
          count++;
        }
      }
      mean[i] = count > 0 ? sum / count : (NaN as number);
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
    cloud_cover_low: (ens.cloud_cover_low ?? []) as number[],
    cloud_cover_mid: (ens.cloud_cover_mid ?? []) as number[],
    cloud_cover_high: (ens.cloud_cover_high ?? []) as number[],
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
    precipitation_hours: [],
  };
  return { latitude: 0, longitude: 0, timezone: "", hourly: empty, daily: emptyDaily };
}

/**
 * Richtet MOSMIX-Stundenwerte (UTC) auf die OM-lokale Zeitachse aus.
 * Werte vor `minLocalHourIndex` (Tag-6-Beginn) werden mit NaN maskiert,
 * damit fillGaps sie nicht in den ICON-Bereich injiziert.
 */
function alignMosmixToTimeline(
  mosmix: MosmixHourly,
  localTimes: string[],
  offsetSeconds: number,
  minLocalHourIndex: number,
): ForecastResponse | null {
  // MOSMIX-UTC-ms → Index
  const mosIdxByUtcMs = new Map<number, number>();
  for (let i = 0; i < mosmix.time.length; i++) {
    const ms = Date.parse(mosmix.time[i]);
    if (Number.isFinite(ms)) mosIdxByUtcMs.set(Math.floor(ms / 3600000) * 3600000, i);
  }

  const n = localTimes.length;
  const mk = () => new Array<number>(n).fill(NaN);
  const out = {
    time: localTimes,
    weathercode: mk(),
    temperature_2m: mk(),
    precipitation: mk(),
    precipitation_probability: mk(),
    windspeed_10m: mk(),
    windgusts_10m: mk(),
    winddirection_10m: mk(),
    snowfall: mk(),
    sunshine_duration: mk(),
  } as HourlyData;

  let matched = 0;
  for (let i = 0; i < n; i++) {
    if (i < minLocalHourIndex) continue;
    const t = localTimes[i];
    if (!t) continue;
    // OM-lokal als-ob-UTC parsen, dann offset abziehen → echter UTC-ms.
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t);
    if (!m) continue;
    const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const utcMs = asUtc - offsetSeconds * 1000;
    const key = Math.floor(utcMs / 3600000) * 3600000;
    const j = mosIdxByUtcMs.get(key);
    if (j == null) continue;
    matched++;
    out.weathercode[i] = mosmix.weathercode[j];
    out.temperature_2m[i] = mosmix.temperature_2m[j];
    out.precipitation[i] = mosmix.precipitation[j];
    out.windspeed_10m[i] = mosmix.windspeed_10m[j];
    out.windgusts_10m[i] = mosmix.windgusts_10m[j];
    out.winddirection_10m[i] = mosmix.winddirection_10m[j];
    out.snowfall[i] = mosmix.snowfall[j];
    out.sunshine_duration[i] = mosmix.sunshine_duration[j];
  }
  if (matched === 0) return null;

  const emptyDaily: DailyData = {
    time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [],
    precipitation_sum: [], precipitation_probability_max: [], windspeed_10m_max: [],
    windgusts_10m_max: [], winddirection_10m_dominant: [], sunshine_duration: [],
    sunrise: [], sunset: [], snowfall_sum: [], precipitation_hours: [],
  };
  return { latitude: 0, longitude: 0, timezone: "", hourly: out, daily: emptyDaily };
}

export function aggregateDailyFromHourly(h: HourlyData, dayIso: string) {
  const day = dayIso.slice(0, 10);
  const idxs: number[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i] ?? "";
    if (t.slice(0, 10) !== day) continue;
    // Nur Tagstunden 06:00–21:00 lokal einbeziehen.
    const hh = Number(t.slice(11, 13));
    if (!Number.isFinite(hh) || hh < 6 || hh >= 21) continue;
    idxs.push(i);
  }
  if (idxs.length === 0) return {} as Record<string, number | null>;
  // Volltag (00–23) für Temperatur/Wind — diese Größen sollen Nachtwerte einbeziehen.
  const allIdxs: number[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i] ?? "";
    if (t.slice(0, 10) === day) allIdxs.push(i);
  }
  const finite = (arr: number[] | undefined): number[] =>
    idxs
      .map((i) => arr?.[i])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const finiteAll = (arr: number[] | undefined): number[] =>
    allIdxs
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
  const dirs = finiteAll(h.winddirection_10m);
  const speeds = finiteAll(h.windspeed_10m);
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
  const precipFinite = finite(h.precipitation);
  const precipHours = precipFinite.reduce((n, v) => (v >= 0.1 ? n + 1 : n), 0);
  const precipSum = precipFinite.reduce((x, y) => x + y, 0);
  const sunSec = finite(h.sunshine_duration).reduce((x, y) => x + y, 0);
  const sunshineRatio = sunSec / (15 * 3600);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  // Tages-WMO-Code, dreistufig:
  // 1) Trocken (sonnig/wolkig) – nur Bewölkung entscheidet (Code 0–3).
  // 2) Schauertag – Niederschlag UND Sonne/Trockenphase → 80/81/82 (95 bei Gewitter).
  // 3) Dauerregen – nur wenn Niederschlag den Tag wirklich dominiert.
  const dryHours = idxs.length - precipHours;
  const maxHourlyPrecip = precipFinite.length ? Math.max(...precipFinite) : 0;
  const thunderHours = idxs.reduce((n, i) => {
    const c = h.weathercode?.[i];
    return c === 95 || c === 96 || c === 99 ? n + 1 : n;
  }, 0);
  const cloudLowMean = mean(finite(h.cloud_cover_low)) ?? 0;
  const cloudMidMean = mean(finite(h.cloud_cover_mid)) ?? 0;
  const cloudHighMean = mean(finite(h.cloud_cover_high)) ?? 0;

  const adjustForClouds = (code: number | null): number | null => {
    if (code == null) return code;
    if (code > 3) return code;
    if (cloudLowMean >= 60) return 3;
    if (cloudMidMean >= 50 || cloudLowMean >= 30) return Math.max(code, 2);
    if (cloudHighMean >= 40 || cloudMidMean >= 25) return Math.max(code, 1);
    return code;
  };

  const isDry = precipHours <= 1 && precipSum < 1;
  const isPersistentRain =
    precipHours >= 8 || (precipHours >= 6 && sunshineRatio < 0.15);
  const isShowerDay =
    !isDry && !isPersistentRain &&
    precipHours >= 1 &&
    (dryHours >= 4 || sunshineRatio >= 0.20);

  let weathercode: number | null;
  if (isDry) {
    const dryCodes = idxs
      .filter((i) => !((h.precipitation?.[i] ?? 0) >= 0.1))
      .map((i) => h.weathercode?.[i])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    weathercode = adjustForClouds(
      representativeWeathercode(dryCodes) ?? representativeWeathercode(finite(h.weathercode)),
    );
  } else if (isShowerDay) {
    if (thunderHours >= 1) {
      weathercode = 95;
    } else if (maxHourlyPrecip >= 7.5) {
      weathercode = 82;
    } else if (maxHourlyPrecip >= 2.5 || precipSum >= 10) {
      weathercode = 81;
    } else {
      weathercode = 80;
    }
  } else {
    weathercode = representativeWeathercode(finite(h.weathercode), {
      preferShower: false,
    });
    if (weathercode == null || weathercode < 50) {
      weathercode = precipSum >= 15 ? 65 : precipSum >= 5 ? 63 : 61;
    }
  }

  return {
    weathercode,
    thunderstorm_hours: thunderHours,

    temperature_2m_max: max(finiteAll(h.temperature_2m)),
    temperature_2m_min: min(finiteAll(h.temperature_2m)),
    precipitation_sum: sum(precipFinite),
    precipitation_hours: precipHours,
    windspeed_10m_max: max(finiteAll(h.windspeed_10m)),
    windgusts_10m_max: max(finiteAll(h.windgusts_10m)),
    winddirection_10m_dominant: dominantDir,
    sunshine_duration: sum(finite(h.sunshine_duration)),
    snowfall_sum: sum(finite(h.snowfall)),
    cloud_cover_low_mean: mean(finite(h.cloud_cover_low)),
    cloud_cover_mid_mean: mean(finite(h.cloud_cover_mid)),
    cloud_cover_high_mean: mean(finite(h.cloud_cover_high)),
  } as Record<string, number | null>;
}


/**
 * Direktes Multi-Modell-Aggregat (Ensembles + best_match + MOSMIX).
 * Wird serverseitig von getAggregatedForecast verwendet (Edge-Cache + Worker-IP).
 */
export async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastResponse> {
  // ICON-CH1-EPS für Stunden 0–24, danach ICON-CH2-EPS (bis Tag 5),
  // ab Tag 6 zusätzlich DWD-MOSMIX (vor ECMWF IFS Ensemble bis Tag 7).
  // best_match nur als Restfallback für Felder, die Ensembles nicht liefern
  // (Probability, Sunrise/Sunset).
  const [ch1RawFull, ch2Raw, ifsRaw, bestMatch, mosmixRaw] = await Promise.all([
    fetchEnsembleMean(latitude, longitude, "meteoswiss_icon_ch1").catch(() => null),
    fetchEnsembleMean(latitude, longitude, "meteoswiss_icon_ch2").catch(() => null),
    fetchEnsembleMean(latitude, longitude, "ecmwf_ifs025").catch(() => null),
    fetchModel(latitude, longitude, "best_match").catch(() => null),
    fetchMosmix({ data: { latitude, longitude } }).catch((e) => {
      console.warn("MOSMIX nicht verfügbar:", e);
      return null;
    }),
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

  // utc_offset_seconds aus einer Quelle ableiten (für MOSMIX-Alignment).
  const offsetSec =
    ch1RawFull?.utc_offset_seconds ??
    ch2Raw?.utc_offset_seconds ??
    ifsRaw?.utc_offset_seconds ??
    (bestMatch as unknown as { utc_offset_seconds?: number } | null)?.utc_offset_seconds ??
    0;

  let merged = primary;
  if (ch2Raw && primarySource !== "ch2") merged = fillGaps(merged, wrapEnsembleAsForecast(ch2Raw));

  // IFS zuerst mergen, damit die Timeline 168h umfasst — sonst hat MOSMIX keine Slots ab Index 120.
  if (ifsRaw && primarySource !== "ifs") merged = fillGaps(merged, wrapEnsembleAsForecast(ifsRaw));

  // MOSMIX ist ab Tag 6 die priorisierte Quelle und überschreibt CH2/IFS/best_match.
  if (mosmixRaw) {
    const mosmixForecast = alignMosmixToTimeline(mosmixRaw, merged.hourly.time, offsetSec, 5 * 24);
    if (mosmixForecast) merged = overwriteFromIndex(merged, mosmixForecast, 5 * 24);
  }

  if (bestMatch && primarySource !== "best_match") merged = fillGaps(merged, bestMatch);

  // Gewitter-Override: Ensemble-Mittel glättet seltene Gewittercodes (95/96/99) weg.
  // Wenn best_match oder MOSMIX an einer Stunde Gewitter sehen, in merged.hourly.weathercode
  // hochstufen — alle anderen Felder bleiben unverändert.
  const isThunder = (c: unknown): boolean =>
    c === 95 || c === 96 || c === 99;
  const timeIndex = new Map<string, number>();
  for (let i = 0; i < merged.hourly.time.length; i++) {
    timeIndex.set(merged.hourly.time[i] ?? "", i);
  }
  const overlayThunder = (src: ForecastResponse | null) => {
    if (!src?.hourly?.time || !src.hourly.weathercode) return;
    for (let j = 0; j < src.hourly.time.length; j++) {
      if (!isThunder(src.hourly.weathercode[j])) continue;
      const i = timeIndex.get(src.hourly.time[j] ?? "");
      if (i == null) continue;
      // Geisterblitze vermeiden: nur übernehmen, wenn auch leichter Niederschlag vorliegt.
      const p = src.hourly.precipitation?.[j] ?? merged.hourly.precipitation?.[i] ?? 0;
      if (p < 0.5) continue;
      merged.hourly.weathercode[i] = src.hourly.weathercode[j] as number;
    }
  };
  overlayThunder(bestMatch ?? null);
  if (mosmixRaw) {
    const mosmixFc = alignMosmixToTimeline(mosmixRaw, merged.hourly.time, offsetSec, 0);
    overlayThunder(mosmixFc);
  }


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
    let arr = merged.daily[key] as (number | string)[] | undefined;
    if (!Array.isArray(arr)) {
      arr = [];
      (merged.daily as unknown as Record<string, unknown>)[key as string] = arr;
    }
    // NaN als "fehlt"-Marker, damit Konsumenten nicht fälschlich 0° anzeigen.
    while (arr.length < dailyTimes.length) arr.push(NaN as never);
  };

  (["weathercode","temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","windspeed_10m_max","windgusts_10m_max","winddirection_10m_dominant","sunshine_duration","snowfall_sum","precipitation_hours","thunderstorm_hours","cloud_cover_low_mean","cloud_cover_mid_mean","cloud_cover_high_mean"] as (keyof DailyData)[])
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
    apply("precipitation_hours");
    apply("thunderstorm_hours");
    apply("windspeed_10m_max");
    apply("windgusts_10m_max");
    apply("winddirection_10m_dominant");
    apply("sunshine_duration");
    apply("snowfall_sum");
    apply("cloud_cover_low_mean");
    apply("cloud_cover_mid_mean");
    apply("cloud_cover_high_mean");
  }


  return sanitizeForecast(merged);
}







function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function sanitizeForecast(data: ForecastResponse): ForecastResponse {
  const h = data.hourly;
  const d = data.daily;

  const fixNumArr = (arr: (number | null)[] | undefined, fallback = 0) =>
    (arr ?? []).map((v) => num(v, fallback));
  // Behält NaN/null für Daily-Werte als "fehlt"-Marker, damit Kacheln keine
  // falschen 0°-Werte rendern, sondern den fehlenden Zustand erkennen.
  const keepNaNArr = (arr: (number | null)[] | undefined): number[] =>
    (arr ?? []).map((v) =>
      typeof v === "number" && Number.isFinite(v) ? v : NaN,
    );

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
    cloud_cover_low: fixNumArr(h?.cloud_cover_low as (number | null)[] | undefined),
    cloud_cover_mid: fixNumArr(h?.cloud_cover_mid as (number | null)[] | undefined),
    cloud_cover_high: fixNumArr(h?.cloud_cover_high as (number | null)[] | undefined),
  };


  const sanitizedDaily: DailyData = {
    time: d?.time ?? [],
    weathercode: fixNumArr(d?.weathercode as (number | null)[]),
    temperature_2m_max: keepNaNArr(d?.temperature_2m_max as (number | null)[]),
    temperature_2m_min: keepNaNArr(d?.temperature_2m_min as (number | null)[]),
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
    precipitation_hours: fixNumArr(d?.precipitation_hours as (number | null)[]),
    thunderstorm_hours: fixNumArr(d?.thunderstorm_hours as (number | null)[] | undefined),
    cloud_cover_low_mean: fixNumArr(d?.cloud_cover_low_mean as (number | null)[] | undefined),
    cloud_cover_mid_mean: fixNumArr(d?.cloud_cover_mid_mean as (number | null)[] | undefined),
    cloud_cover_high_mean: fixNumArr(d?.cloud_cover_high_mean as (number | null)[] | undefined),
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
