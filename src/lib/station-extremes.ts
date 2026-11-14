/** Tages-Extremwerte der regionalen Stationen (rein, getestet). */
export type ExtremeStat = "min" | "max" | "current" | "gust" | "rain";
export interface StationExtreme { id: string; name: string; lat: number; lon: number; min: number | null; max: number | null; current?: number | null; gust?: number | null; rain?: number | null }

type ExtremeStation = Pick<StationExtreme, "id" | "name" | "lat" | "lon">;
export interface ExtremeDailyReading { station_id: string; temp_min: number | null; temp_max: number | null; wind_max_gust?: number | null; rain_sum?: number | null }
export interface StationLiveReading { station_id: string; measured_at: string; temperature: number | null }

export const STATION_STAT_LABELS: Record<ExtremeStat, string> = {
  min: "Tiefsttemperatur heute", max: "Höchsttemperatur heute", current: "Aktuelle Temperaturen",
  gust: "Stärkste Windböen heute", rain: "Gesamtniederschlag heute",
};
export function formatStationValue(value: number, stat: ExtremeStat): string {
  return stat === "gust" ? `${Math.round(value)} km/h` : stat === "rain" ? `${value.toFixed(1)} mm` : `${value.toFixed(1)}°`;
}

/** Dieselben Kennungen und Koordinaten wie im Weather Hub; nur für die Ticker-Extremwertkarten. */
export const EXTREME_REFERENCE_STATIONS: ExtremeStation[] = [
  { id: "22222222-2222-4222-8222-222222222222", name: "Sitterdorf-Bischofszell", lat: 47.5104, lon: 9.2607 },
  { id: "11111111-1111-4111-8111-111111111111", name: "Güttingen", lat: 47.6019, lon: 9.2789 },
];

export function stationExtremes(stations: ExtremeStation[], readings: ExtremeDailyReading[]): StationExtreme[] {
  const byId = new Map(readings.map((row) => [row.station_id, row]));
  return stations.map((station) => ({
    ...station,
    min: byId.get(station.id)?.temp_min ?? null,
    max: byId.get(station.id)?.temp_max ?? null,
  }));
}

/** Tageswerte sind keine Livewerte; fehlende Messungen bleiben fehlend. Böenquelle: m/s. */
export function stationReadings(stations: ExtremeStation[], daily: ExtremeDailyReading[], live: StationLiveReading[], now: number): StationExtreme[] {
  const byId = new Map(daily.map((r) => [r.station_id, r]));
  const latest = new Map<string, StationLiveReading>();
  for (const row of live) {
    const previous = latest.get(row.station_id);
    if (!previous || Date.parse(row.measured_at) > Date.parse(previous.measured_at)) latest.set(row.station_id, row);
  }
  const valid = (v: number | null | undefined) => typeof v === "number" && Number.isFinite(v) ? v : null;
  return stationExtremes(stations, daily).map((station) => {
    const row = byId.get(station.id), measurement = latest.get(station.id);
    const age = measurement ? now - Date.parse(measurement.measured_at) : Infinity;
    const gust = valid(row?.wind_max_gust), rain = valid(row?.rain_sum);
    return { ...station, current: age >= 0 && age <= 30 * 60_000 ? valid(measurement?.temperature) : null,
      gust: gust !== null && gust >= 0 ? gust * 3.6 : null, rain: rain !== null && rain >= 0 ? rain : null };
  });
}

export const zurichDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Stationen mit gültigem Wert, sortiert: bei Min die kälteste zuerst, bei Max die wärmste. */
export function rankExtremes(rows: StationExtreme[], stat: ExtremeStat): StationExtreme[] {
  return rows
    .filter((r) => typeof r[stat] === "number" && Number.isFinite(r[stat]))
    .sort((a, b) => (stat === "min" ? (a[stat] ?? 0) - (b[stat] ?? 0) : (b[stat] ?? 0) - (a[stat] ?? 0)));
}

export const parseStat = (v: unknown): ExtremeStat => (v === "max" || v === "current" || v === "gust" || v === "rain" ? v : "min");
