/** Tages-Extremwerte der regionalen Stationen (rein, getestet). */
export type ExtremeStat = "min" | "max";
export interface StationExtreme { id: string; name: string; lat: number; lon: number; min: number | null; max: number | null }

type ExtremeStation = Pick<StationExtreme, "id" | "name" | "lat" | "lon">;
export interface ExtremeDailyReading { station_id: string; temp_min: number | null; temp_max: number | null }

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

export const zurichDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Stationen mit gültigem Wert, sortiert: bei Min die kälteste zuerst, bei Max die wärmste. */
export function rankExtremes(rows: StationExtreme[], stat: ExtremeStat): StationExtreme[] {
  return rows
    .filter((r) => typeof r[stat] === "number" && Number.isFinite(r[stat]))
    .sort((a, b) => (stat === "min" ? (a.min ?? 0) - (b.min ?? 0) : (b.max ?? 0) - (a.max ?? 0)));
}

export const parseStat = (v: unknown): ExtremeStat => (v === "max" ? "max" : "min");
