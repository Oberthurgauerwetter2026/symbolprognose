/** Tages-Extremwerte der eigenen Stationen (rein, getestet). */
export type ExtremeStat = "min" | "max";
export interface StationExtreme { id: string; name: string; lat: number; lon: number; min: number | null; max: number | null }

export const zurichDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Stationen mit gültigem Wert, sortiert: bei Min die kälteste zuerst, bei Max die wärmste. */
export function rankExtremes(rows: StationExtreme[], stat: ExtremeStat): StationExtreme[] {
  return rows
    .filter((r) => typeof r[stat] === "number" && Number.isFinite(r[stat]))
    .sort((a, b) => (stat === "min" ? a.min! - b.min! : b.max! - a.max!));
}

export const parseStat = (v: unknown): ExtremeStat => (v === "max" ? "max" : "min");
