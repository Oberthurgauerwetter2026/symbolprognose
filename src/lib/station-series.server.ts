/** Verläufe und Periodensummen der regionalen Stationen aus den öffentlich lesbaren Tabellen des Weather Hub. */
import { HUB_KEY, HUB_URL, OWN_STATIONS } from "./own-stations.server";
import { EXTREME_REFERENCE_STATIONS, zurichDay } from "./station-extremes";
import { clampSumRange, resolveWindow, seriesPoint, summarise, type DailySumRow, type RainOverride, type SeriesPoint, type SeriesRange, type SeriesWindow, type StationSum, type SumStationDef } from "./station-series";

const PAGE = 1000;
export const SERIES_STATIONS: SumStationDef[] = [
  ...OWN_STATIONS.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, source: "own" as const })),
  ...EXTREME_REFERENCE_STATIONS.map((s) => ({ ...s, source: "meteoswiss" as const })),
];

/** Die Quelle liefert höchstens 1000 Zeilen pro Abruf; darum seitenweise mit fester Sortierung. */
async function hubRead<T>(path: string, maxPages: number): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`${HUB_URL}/rest/v1/${path}&limit=${PAGE}&offset=${page * PAGE}`, { headers: { apikey: HUB_KEY, accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Weather Hub HTTP ${res.status}`);
    const rows = await res.json() as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

const overridesFor = (filter: string, from: string, to: string) =>
  hubRead<RainOverride>(`rain_daily_overrides?select=station_id,day,rain_sum&${filter}&day=gte.${from}&day=lte.${to}&order=station_id,day`, 12).catch(() => [] as RainOverride[]);

export interface SeriesResult { stationId: string; window: SeriesWindow; points: SeriesPoint[]; failed: boolean }
export async function loadSeries(input: { stationId: string; range: SeriesRange; anchor?: string | undefined; from?: string | undefined; to?: string | undefined }): Promise<SeriesResult> {
  const window = resolveWindow(input.range, zurichDay(Date.now()), input.anchor, input.from, input.to);
  const empty = { stationId: input.stationId, window, points: [] as SeriesPoint[] };
  if (!SERIES_STATIONS.some((s) => s.id === input.stationId)) return { ...empty, failed: true };
  const station = `station_id=eq.${input.stationId}`, span = (column: string) => `${column}=gte.${encodeURIComponent(new Date(window.from).toISOString())}&${column}=lt.${encodeURIComponent(new Date(window.to).toISOString())}`;
  try {
    let rows: Record<string, unknown>[];
    if (window.resolution === "raw") rows = await hubRead(`readings?select=measured_at,temperature,dew_point,humidity,pressure,rain_inc,wind_speed,wind_gust,wind_dir&${station}&${span("measured_at")}&order=measured_at`, 4);
    else if (window.resolution === "hourly") rows = await hubRead(`readings_hourly?select=hour_start,temp_avg,temp_min,temp_max,dew_point_avg,humidity_avg,pressure_avg,wind_avg,wind_max_gust,wind_dir_avg,rain_sum&${station}&${span("hour_start")}&order=hour_start`, 3);
    else {
      const [daily, manual] = await Promise.all([
        hubRead<Record<string, unknown>>(`readings_daily?select=day,temp_avg,temp_min,temp_max,dew_point_avg,humidity_avg,pressure_avg,wind_avg,wind_max_gust,wind_dir_avg,rain_sum&${station}&day=gte.${window.fromDay}&day=lte.${window.toDay}&order=day`, 3),
        overridesFor(station, window.fromDay, window.toDay),
      ]);
      const fixed = new Map(manual.map((o) => [String(o.day).slice(0, 10), o.rain_sum]));
      rows = daily.map((row) => { const day = String(row["day"]).slice(0, 10); return fixed.has(day) ? { ...row, rain_sum: fixed.get(day) } : row; });
    }
    return { ...empty, points: rows.flatMap((row) => seriesPoint(window.resolution, row) ?? []), failed: false };
  } catch (error) {
    console.warn("[station-series]", error instanceof Error ? error.message : error);
    return { ...empty, failed: true };
  }
}

export interface SumsResult { from: string; to: string; stations: StationSum[]; failed: boolean }
export async function loadSums(input: { from: string; to: string }): Promise<SumsResult> {
  const { from, to } = clampSumRange(input.from, input.to);
  const ids = `station_id=in.(${SERIES_STATIONS.map((s) => s.id).join(",")})`;
  try {
    const [rows, manual] = await Promise.all([
      hubRead<DailySumRow>(`readings_daily?select=station_id,day,rain_sum,temp_avg,temp_min,temp_max,wind_max_gust&${ids}&day=gte.${from}&day=lte.${to}&order=station_id,day`, 12),
      overridesFor(ids, from, to),
    ]);
    return { from, to, stations: summarise(SERIES_STATIONS, rows, manual), failed: false };
  } catch (error) {
    console.warn("[station-sums]", error instanceof Error ? error.message : error);
    return { from, to, stations: [], failed: true };
  }
}
