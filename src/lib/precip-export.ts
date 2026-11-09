/** Reine Export-Helfer für Niederschlags-/Neuschneesummen (intern, getestet). */
import type { PastSums } from "./precip-past.functions";
import { PAST_WINDOWS } from "./precip-past";

const cell = (v: number | null | undefined) => (v === null || v === undefined || v < 0 ? "" : String(Math.round(v * 10) / 10));

/** CSV (Semikolon, Excel-CH-freundlich): Stationen + Rasterpunkte, gefallen und Prognose. */
export function sumsToCsv(d: PastSums): string {
  const rows: string[] = [];
  const head = ["typ", "id", "name", "lat", "lon", "alt"];
  for (const w of PAST_WINDOWS) head.push(`regen_${w}h_mm`, `schnee_${w}h_cm`);
  for (const w of PAST_WINDOWS) head.push(`prog_regen_${w}h_mm`, `prog_schnee_${w}h_cm`);
  rows.push(head.join(";"));
  for (const s of d.stations) {
    const r = [s.source === "own" ? "station_eigen" : "station_mch", s.id, s.name, s.lat, s.lon, s.alt].map(String);
    for (const w of PAST_WINDOWS) r.push(cell(s.rain[w]), cell(s.snow[w]));
    for (const _ of PAST_WINDOWS) r.push("", "");
    rows.push(r.join(";"));
  }
  const nLon = d.gridLon.length;
  for (let i = 0; i < d.gridLat.length * nLon; i++) {
    const r = ["raster_modell", `g${i}`, "", d.gridLat[Math.floor(i / nLon)], d.gridLon[i % nLon], ""].map(String);
    for (const w of PAST_WINDOWS) r.push(cell(d.rain[w]?.[i]), cell(d.snow[w]?.[i]));
    for (const w of PAST_WINDOWS) r.push(cell(d.forecast?.rain[w]?.[i]), cell(d.forecast?.snow[w]?.[i]));
    rows.push(r.join(";"));
  }
  return rows.join("\n") + "\n";
}

export function exportFilename(d: PastSums, ext: "csv" | "json") {
  return `niederschlag-summen-${d.generatedAt.slice(0, 16).replace(":", "")}.${ext}`;
}

export function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
