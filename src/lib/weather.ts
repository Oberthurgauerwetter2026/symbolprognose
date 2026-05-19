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
] as const;

// Index where we switch from MeteoSchweiz ICON to ECMWF IFS (0-based day index).
// 0..ECMWF_FROM_DAY-1 use ICON, ECMWF_FROM_DAY..end use ECMWF.
const ECMWF_FROM_DAY = 4;
const TOTAL_DAYS = 7;

async function fetchModel(
  latitude: number,
  longitude: number,
  model: "meteoswiss_icon_seamless" | "ecmwf_ifs025",
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

export async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastResponse> {
  const [iconRes, ecmwfRes] = await Promise.allSettled([
    fetchModel(latitude, longitude, "meteoswiss_icon_seamless"),
    fetchModel(latitude, longitude, "ecmwf_ifs025"),
  ]);

  // Fallbacks if one model fails.
  if (iconRes.status !== "fulfilled" && ecmwfRes.status !== "fulfilled") {
    throw new Error("Wetterdaten konnten nicht geladen werden");
  }
  if (iconRes.status !== "fulfilled") {
    return sanitizeForecast((ecmwfRes as PromiseFulfilledResult<ForecastResponse>).value);
  }
  if (ecmwfRes.status !== "fulfilled") {
    return sanitizeForecast(iconRes.value);
  }

  return sanitizeForecast(mergeForecasts(iconRes.value, ecmwfRes.value));
}

function mergeForecasts(
  icon: ForecastResponse,
  ecmwf: ForecastResponse,
): ForecastResponse {
  // Determine which dates belong to ECMWF (by date string, from ICON's daily).
  const iconDates = icon.daily?.time ?? [];
  const ecmwfDateSet = new Set(iconDates.slice(ECMWF_FROM_DAY));

  // --- Daily merge ---
  const mergedDaily: DailyData = { ...icon.daily };
  const ecmwfDayIdxByDate = new Map<string, number>();
  (ecmwf.daily?.time ?? []).forEach((d, i) => ecmwfDayIdxByDate.set(d, i));

  const dailyKeys: (keyof DailyData)[] = [
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
  ];

  for (const key of dailyKeys) {
    const src = icon.daily[key] as (number | string | null)[] | undefined;
    if (!src) continue;
    const copy = [...src] as (number | string | null)[];
    iconDates.forEach((date, i) => {
      if (!ecmwfDateSet.has(date)) return;
      const ei = ecmwfDayIdxByDate.get(date);
      if (ei === undefined) return;
      const ecmwfArr = ecmwf.daily[key] as (number | string | null)[] | undefined;
      if (!ecmwfArr) return;
      copy[i] = ecmwfArr[ei] ?? copy[i];
    });
    // @ts-expect-error dynamic key assignment back into typed array
    mergedDaily[key] = copy;
  }

  // --- Hourly merge ---
  const mergedHourly: HourlyData = { ...icon.hourly };
  const ecmwfHourIdxByIso = new Map<string, number>();
  (ecmwf.hourly?.time ?? []).forEach((t, i) => ecmwfHourIdxByIso.set(t, i));

  const hourlyKeys: (keyof HourlyData)[] = [
    "weathercode",
    "temperature_2m",
    "precipitation",
    "precipitation_probability",
    "windspeed_10m",
    "windgusts_10m",
    "winddirection_10m",
    "snowfall",
  ];

  const iconTimes = icon.hourly?.time ?? [];
  for (const key of hourlyKeys) {
    const src = icon.hourly[key] as (number | string | null)[] | undefined;
    if (!src) continue;
    const copy = [...src] as (number | string | null)[];
    iconTimes.forEach((iso, i) => {
      const date = iso.slice(0, 10);
      if (!ecmwfDateSet.has(date)) return;
      const ei = ecmwfHourIdxByIso.get(iso);
      if (ei === undefined) return;
      const ecmwfArr = ecmwf.hourly[key] as (number | string | null)[] | undefined;
      if (!ecmwfArr) return;
      copy[i] = ecmwfArr[ei] ?? copy[i];
    });
    // @ts-expect-error dynamic key assignment back into typed array
    mergedHourly[key] = copy;
  }

  return {
    ...icon,
    daily: mergedDaily,
    hourly: mergedHourly,
  };
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
