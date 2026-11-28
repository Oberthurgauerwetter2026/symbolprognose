/** Stationsverläufe und Periodensummen aus dem Weather Hub (rein, getestet). */
export type SeriesRange = "day" | "month" | "year" | "custom";
export type SeriesResolution = "raw" | "hourly" | "daily";
export type SeriesMetric = "temperature" | "dew" | "pressure" | "rain" | "wind";
export const SERIES_RANGES: readonly SeriesRange[] = ["day", "month", "year", "custom"];
export const SERIES_METRICS: readonly SeriesMetric[] = ["temperature", "dew", "pressure", "rain", "wind"];
/** Älteste Messreihe im Weather Hub. */
export const FIRST_YEAR = 2013;
const MAX_SERIES_DAYS = 1830, MAX_SUM_DAYS = 1100;

export interface SeriesPoint {
  t: number; temp: number | null; tmin: number | null; tmax: number | null; dew: number | null; hum: number | null;
  pres: number | null; wind: number | null; gust: number | null; dir: number | null; rain: number | null;
}
export interface SeriesWindow { from: number; to: number; resolution: SeriesResolution; fromDay: string; toDay: string }

const ZURICH = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
/** UTC-Zeitpunkt von 00:00 Zürich; Monat und Tag dürfen überlaufen (13. Monat, 32. Tag). */
export function zurichMidnight(y: number, m: number, d: number): number {
  const guess = Date.UTC(y, m - 1, d);
  const parts = ZURICH.formatToParts(guess);
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return guess - (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - guess);
}
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const parts = (day: string): [number, number, number] => { const [y = 0, m = 1, d = 1] = day.split("-").map(Number); return [y, m || 1, d || 1]; };
export const addDays = (day: string, n: number) => { const [y, m, d] = parts(day); return iso(y, m, d + n); };
export const dayStart = (day: string) => { const [y, m, d] = parts(day); return zurichMidnight(y, m, d); };
const daySpan = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const ordered = (a: string, b: string, max: number): [string, string] => {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return [daySpan(from, to) > max ? addDays(to, -(max - 1)) : from, to];
};

/** Zeitfenster in Zürcher Kalendertagen; die Auflösung folgt der Länge. */
export function resolveWindow(range: SeriesRange, today: string, anchor?: string, from?: string, to?: string): SeriesWindow {
  const [ay, am, ad] = parts(anchor ?? today);
  if (range === "custom") {
    const [f, t] = ordered(from ?? today, to ?? today, MAX_SERIES_DAYS);
    const days = daySpan(f, t);
    return { from: dayStart(f), to: dayStart(addDays(t, 1)), resolution: days <= 2 ? "raw" : days <= 62 ? "hourly" : "daily", fromDay: f, toDay: t };
  }
  if (range === "day") {
    const day = iso(ay, am, ad);
    return { from: dayStart(day), to: dayStart(addDays(day, 1)), resolution: "raw", fromDay: day, toDay: day };
  }
  if (range === "month") return { from: zurichMidnight(ay, am, 1), to: zurichMidnight(ay, am + 1, 1), resolution: "hourly", fromDay: iso(ay, am, 1), toDay: iso(ay, am + 1, 0) };
  return { from: zurichMidnight(ay, 1, 1), to: zurichMidnight(ay + 1, 1, 1), resolution: "daily", fromDay: iso(ay, 1, 1), toDay: iso(ay, 12, 31) };
}

/** Anker (Tag, Monat oder Jahr) um n Einheiten verschieben; nie in die Zukunft, nie vor die erste Messreihe. */
export function shiftAnchor(range: "day" | "month" | "year", anchor: string, n: number, today: string): string {
  const [y, m, d] = parts(anchor);
  const next = range === "day" ? iso(y, m, d + n) : range === "month" ? iso(y, m + n, 1) : iso(y + n, 1, 1);
  const first = `${FIRST_YEAR}-01-01`;
  return next > today ? today : next < first ? first : next;
}

const num = (v: unknown): number | null => { const n = typeof v === "string" && v !== "" ? Number(v) : v; return typeof n === "number" && Number.isFinite(n) ? n : null; };
const kmh = (v: unknown) => { const n = num(v); return n === null || n < 0 ? null : n * 3.6; };
const mm = (v: unknown) => { const n = num(v); return n === null || n < 0 ? null : n; };
type Row = Record<string, unknown>;
/** Zeile der Hub-Tabellen readings, readings_hourly oder readings_daily; Wind dort in m/s. */
export function seriesPoint(resolution: SeriesResolution, row: Row): SeriesPoint | null {
  if (resolution === "raw") {
    const t = Date.parse(String(row["measured_at"]));
    if (!Number.isFinite(t)) return null;
    return { t, temp: num(row["temperature"]), tmin: null, tmax: null, dew: num(row["dew_point"]), hum: num(row["humidity"]), pres: num(row["pressure"]),
      wind: kmh(row["wind_speed"]), gust: kmh(row["wind_gust"]), dir: num(row["wind_dir"]), rain: mm(row["rain_inc"]) };
  }
  const t = resolution === "hourly" ? Date.parse(String(row["hour_start"])) : /^\d{4}-\d{2}-\d{2}/.test(String(row["day"])) ? dayStart(String(row["day"]).slice(0, 10)) : NaN;
  if (!Number.isFinite(t)) return null;
  return { t, temp: num(row["temp_avg"]), tmin: num(row["temp_min"]), tmax: num(row["temp_max"]), dew: num(row["dew_point_avg"]), hum: num(row["humidity_avg"]), pres: num(row["pressure_avg"]),
    wind: kmh(row["wind_avg"]), gust: kmh(row["wind_max_gust"]), dir: num(row["wind_dir_avg"]), rain: mm(row["rain_sum"]) };
}

export interface SeriesStats { avg: number | null; min: number | null; max: number | null; sum: number | null; last: number | null; lastAt: number | null }
/** Kennzahlen eines Fensters; fehlende Werte zählen nicht mit. Regen: Summe, Wind: Mittel und stärkste Böe. */
export function seriesStats(points: SeriesPoint[], metric: SeriesMetric | "hum"): SeriesStats {
  const key = metric === "temperature" ? "temp" : metric === "dew" ? "dew" : metric === "pressure" ? "pres" : metric === "rain" ? "rain" : metric === "hum" ? "hum" : "wind";
  let total = 0, count = 0, min: number | null = null, max: number | null = null, last: number | null = null, lastAt: number | null = null;
  for (const p of points) {
    const v = p[key];
    const lo = metric === "temperature" ? p.tmin ?? v : v, hi = metric === "temperature" ? p.tmax ?? v : metric === "wind" ? p.gust ?? v : v;
    if (v !== null) { total += v; count++; last = v; lastAt = p.t; }
    if (lo !== null && (min === null || lo < min)) min = lo;
    if (hi !== null && (max === null || hi > max)) max = hi;
  }
  return { avg: count ? total / count : null, min, max, sum: count ? total : null, last, lastAt };
}

export interface RainBucket { t: number; label: string; rain: number | null; sum: number | null }
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
/** Regenbalken: Stunden bei Rohwerten, Tage bei Stundenwerten, Tage oder Monate bei Tageswerten; dazu die laufende Summe bis zur letzten Messung. */
export function rainBuckets(points: SeriesPoint[], win: SeriesWindow): RainBucket[] {
  const starts: { t: number; label: string }[] = [];
  if (win.resolution === "raw") {
    for (let t = win.from; t < win.to; t += 3_600_000) starts.push({ t, label: `${ZURICH.formatToParts(t).find((p) => p.type === "hour")?.value ?? ""} Uhr` });
  } else if (win.resolution === "hourly" || daySpan(win.fromDay, win.toDay) <= 92) {
    for (let day = win.fromDay; day <= win.toDay; day = addDays(day, 1)) { const [, m, d] = parts(day); starts.push({ t: dayStart(day), label: `${d}.${m}.` }); }
  } else {
    const [fy, fm] = parts(win.fromDay), [ty, tm] = parts(win.toDay);
    const years = fy !== ty;
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, m = 1) : m++) starts.push({ t: zurichMidnight(y, m, 1), label: `${MONTHS_SHORT[m - 1] ?? ""}${years ? ` ${String(y).slice(2)}` : ""}` });
  }
  const sums: (number | null)[] = starts.map(() => null);
  let index = 0, lastIndex = -1;
  for (const p of points) {
    while (index + 1 < starts.length && (starts[index + 1]?.t ?? Infinity) <= p.t) index++;
    if (p.rain === null || p.t < (starts[0]?.t ?? Infinity)) continue;
    sums[index] = (sums[index] ?? 0) + p.rain;
    lastIndex = index;
  }
  let running = 0;
  return starts.map((start, i) => {
    const rain = sums[i] ?? null;
    if (rain !== null) running += rain;
    return { ...start, rain: rain === null ? null : Math.round(rain * 10) / 10, sum: i <= lastIndex ? Math.round(running * 10) / 10 : null };
  });
}

/** Achsenmarken an Zürcher Uhrzeiten, Tagen oder Monatsanfängen, je nach Fensterlänge. */
export function timeTicks(win: SeriesWindow): number[] {
  const days = daySpan(win.fromDay, win.toDay), ticks: number[] = [];
  if (days <= 2) { for (let t = win.from; t <= win.to; t += (days === 1 ? 3 : 6) * 3_600_000) ticks.push(t); return ticks; }
  if (days <= 62) {
    const step = days <= 10 ? 1 : days <= 35 ? 5 : 10;
    for (let day = win.fromDay, i = 0; day <= win.toDay; day = addDays(day, 1), i++) if (i % step === 0) ticks.push(dayStart(day));
    return ticks;
  }
  const [fy, fm] = parts(win.fromDay), [ty, tm] = parts(win.toDay);
  const step = days > 800 ? 6 : days > 400 ? 2 : 1;
  for (let y = fy, m = fm, i = 0; y < ty || (y === ty && m <= tm); m === 12 ? (y++, m = 1) : m++, i++) if (i % step === 0) ticks.push(zurichMidnight(y, m, 1));
  return ticks;
}

export type SumPeriod = "now" | "today" | "yesterday" | "month" | "year" | "custom";
export const SUM_PERIODS: readonly SumPeriod[] = ["now", "today", "yesterday", "month", "year", "custom"];
/** Tagesbereich einer Summenperiode; anchor ist Monat (YYYY-MM) oder Jahr (YYYY). */
export function sumRange(period: Exclude<SumPeriod, "now">, today: string, anchor?: string, from?: string, to?: string): { from: string; to: string } {
  const [y, m] = parts(anchor ?? today);
  if (period === "today") return { from: today, to: today };
  if (period === "yesterday") { const day = addDays(today, -1); return { from: day, to: day }; }
  if (period === "month") return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
  if (period === "year") return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
  const [f, t] = ordered(from ?? today, to ?? today, MAX_SUM_DAYS);
  return { from: f, to: t };
}
export const clampSumRange = (from: string, to: string) => { const [f, t] = ordered(from, to, MAX_SUM_DAYS); return { from: f, to: t }; };
export const spanDays = daySpan;

export interface SumStationDef { id: string; name: string; lat: number; lon: number; source: "own" | "meteoswiss" }
export interface DailySumRow { station_id: string; day: string; rain_sum?: unknown; temp_avg?: unknown; temp_min?: unknown; temp_max?: unknown; wind_max_gust?: unknown }
export interface RainOverride { station_id: string; day: string; rain_sum: unknown }
export interface StationSum extends SumStationDef { days: number; rain: number | null; tempAvg: number | null; tempMin: number | null; tempMax: number | null; gust: number | null }
/** Periodenwerte je Station: Regensumme (manuelle Tageswerte ersetzen die Messung), Temperaturmittel und -extreme, stärkste Böe in km/h. */
export function summarise(stations: SumStationDef[], rows: DailySumRow[], overrides: RainOverride[] = []): StationSum[] {
  const manual = new Map<string, number>();
  for (const o of overrides) { const v = mm(o.rain_sum); if (v !== null) manual.set(`${o.station_id}|${String(o.day).slice(0, 10)}`, v); }
  return stations.map((station) => {
    const days = new Map<string, DailySumRow>();
    for (const row of rows) if (row.station_id === station.id) days.set(String(row.day).slice(0, 10), row);
    for (const key of manual.keys()) { const [id = "", day = ""] = key.split("|"); if (id === station.id && !days.has(day)) days.set(day, { station_id: id, day }); }
    let rain: number | null = null, total = 0, count = 0, tempMin: number | null = null, tempMax: number | null = null, gust: number | null = null;
    for (const [day, row] of days) {
      const r = manual.get(`${station.id}|${day}`) ?? mm(row.rain_sum);
      if (r !== null) rain = (rain ?? 0) + r;
      const avg = num(row.temp_avg), lo = num(row.temp_min), hi = num(row.temp_max), g = kmh(row.wind_max_gust);
      if (avg !== null) { total += avg; count++; }
      if (lo !== null && (tempMin === null || lo < tempMin)) tempMin = lo;
      if (hi !== null && (tempMax === null || hi > tempMax)) tempMax = hi;
      if (g !== null && (gust === null || g > gust)) gust = g;
    }
    return { ...station, days: days.size, rain: rain === null ? null : Math.round(rain * 10) / 10, tempAvg: count ? total / count : null, tempMin, tempMax, gust };
  });
}
