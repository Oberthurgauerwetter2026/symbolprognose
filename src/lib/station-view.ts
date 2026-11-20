/** Reine Auswertung für die mobile Einzelstations-Ansicht (/station/<name>). */
import { zurichDay } from "./rain-overrides";

export type RawReading = {
  measured_at: string; temperature: number | null; dew_point: number | null; humidity: number | null;
  pressure: number | null; rain_rate: number | null; wind_speed: number | null; wind_gust: number | null; wind_dir: number | null;
};
export type Ext = { v: number; at: string } | null;
export type DayStats = { tMax: Ext; tMin: Ext; hMax: Ext; hMin: Ext; pMax: Ext; pMin: Ext; gust: Ext; rain: number | null };
export type StationView = {
  name: string; measuredAt: string | null; stale: boolean;
  now: { temp: number | null; dew: number | null; hum: number | null; press: number | null; wind: number | null; gust: number | null; dir: string | null; rainRate: number | null; chill: number | null; heat: number | null };
  today: DayStats; yesterday: DayStats;
};

const DIRS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number | null) => (deg === null || !Number.isFinite(deg) ? null : DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? null);
export const kmh = (ms: number | null) => (ms === null ? null : ms * 3.6);

/** Windchill (Environment Canada) nur ≤10 °C und Wind >4.8 km/h, sonst Lufttemperatur. */
export function windChill(t: number | null, windKmh: number | null): number | null {
  if (t === null) return null;
  if (windKmh === null || t > 10 || windKmh <= 4.8) return t;
  const v = windKmh ** 0.16;
  return 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v;
}
/** Hitzeindex (NOAA/Rothfusz) ab 27 °C, sonst Lufttemperatur. */
export function heatIndex(t: number | null, rh: number | null): number | null {
  if (t === null) return null;
  if (rh === null || t < 27) return t;
  const f = t * 1.8 + 32;
  const hi = -42.379 + 2.04901523 * f + 10.14333127 * rh - 0.22475541 * f * rh - 0.00683783 * f * f
    - 0.05481717 * rh * rh + 0.00122874 * f * f * rh + 0.00085282 * f * rh * rh - 0.00000199 * f * f * rh * rh;
  return (hi - 32) / 1.8;
}

function ext(rows: RawReading[], key: keyof RawReading, max: boolean, scale = 1): Ext {
  let best: Ext = null;
  for (const r of rows) {
    const v = r[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const s = v * scale;
    if (!best || (max ? s > best.v : s < best.v)) best = { v: s, at: r.measured_at };
  }
  return best;
}
function stats(rows: RawReading[], rain: number | null): DayStats {
  return {
    tMax: ext(rows, "temperature", true), tMin: ext(rows, "temperature", false),
    hMax: ext(rows, "humidity", true), hMin: ext(rows, "humidity", false),
    pMax: ext(rows, "pressure", true), pMin: ext(rows, "pressure", false),
    gust: ext(rows, "wind_gust", true, 3.6), rain,
  };
}

export function buildStationView(name: string, rows: RawReading[], rain: { today: number | null; yesterday: number | null }, nowMs: number): StationView {
  const sorted = [...rows].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  const today = zurichDay(nowMs), yest = zurichDay(nowMs - 86_400_000);
  const last = sorted[sorted.length - 1] ?? null;
  const wind = kmh(last?.wind_speed ?? null);
  return {
    name,
    measuredAt: last?.measured_at ?? null,
    stale: !last || nowMs - Date.parse(last.measured_at) > 30 * 60_000,
    now: {
      temp: last?.temperature ?? null, dew: last?.dew_point ?? null, hum: last?.humidity ?? null, press: last?.pressure ?? null,
      wind, gust: kmh(last?.wind_gust ?? null), dir: compass(last?.wind_dir ?? null), rainRate: last?.rain_rate ?? null,
      chill: windChill(last?.temperature ?? null, wind), heat: heatIndex(last?.temperature ?? null, last?.humidity ?? null),
    },
    today: stats(sorted.filter((r) => zurichDay(Date.parse(r.measured_at)) === today), rain.today),
    yesterday: stats(sorted.filter((r) => zurichDay(Date.parse(r.measured_at)) === yest), rain.yesterday),
  };
}

export const stationSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
