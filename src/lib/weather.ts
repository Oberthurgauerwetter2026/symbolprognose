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

export async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("models", "icon_seamless");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "6");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set(
    "daily",
    [
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
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    [
      "weathercode",
      "temperature_2m",
      "precipitation",
      "precipitation_probability",
      "windspeed_10m",
      "windgusts_10m",
      "winddirection_10m",
      "snowfall",
    ].join(","),
  );
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Wetterdaten konnten nicht geladen werden");
  return (await res.json()) as ForecastResponse;
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
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function secondsToHours(sec: number): string {
  return (sec / 3600).toFixed(1);
}
