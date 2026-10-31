/** Reine Auswertung der MeteoSchweiz-SMN-CSV für Stationssummen (getestet). */

export type StationDef = { id: string; name: string; lat: number; lon: number; alt: number };

/** SMN-Stationen im Summen-Ausschnitt mit Niederschlagsmessung. */
export const SUM_STATIONS: StationDef[] = [
  { id: "GUT", name: "Güttingen", lat: 47.6017, lon: 9.2794, alt: 440 },
  { id: "ARH", name: "Altenrhein", lat: 47.4836, lon: 9.5669, alt: 398 },
  { id: "BIZ", name: "Bischofszell", lat: 47.5088, lon: 9.2668, alt: 507 },
  { id: "STG", name: "St. Gallen", lat: 47.4255, lon: 9.3985, alt: 776 },
  { id: "SAE", name: "Säntis", lat: 47.2494, lon: 9.3435, alt: 2501 },
  { id: "TAE", name: "Tänikon", lat: 47.4799, lon: 8.9049, alt: 539 },
  { id: "HAI", name: "Salen-Reutenen", lat: 47.6512, lon: 9.0239, alt: 719 },
  { id: "STK", name: "Steckborn", lat: 47.6686, lon: 8.9814, alt: 397 },
  { id: "SHA", name: "Schaffhausen", lat: 47.6898, lon: 8.6201, alt: 438 },
  { id: "HOE", name: "Hörnli", lat: 47.3709, lon: 8.9416, alt: 1133 },
  { id: "EBK", name: "Ebnat-Kappel", lat: 47.2734, lon: 9.1085, alt: 623 },
  { id: "OBR", name: "Oberriet", lat: 47.3766, lon: 9.6127, alt: 409 },
];

export type Sample = { t: number; precip: number | null; snowDepth: number | null; /** Intervall in ms (Standard 1 h) */ dur?: number };

/** "31.10.2026 14:10" (UTC) → ms */
function parseTs(s: string): number {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Liest eine SMN-CSV. `stepMin` = Intervalllänge (60 für h_*, 10 für t_*).
 * Zeitstempel gelten in der SMN-Konvention für den Intervall-Beginn; wir
 * speichern das Intervall-Ende, damit Fenster (now-h, now] korrekt greifen.
 */
export function parseSmnCsv(csv: string, stepMin: number): Sample[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0].split(";");
  const iT = head.indexOf("reference_timestamp");
  const iP = head.findIndex((h) => h === "rre150h0" || h === "rre150z0");
  const iS = head.findIndex((h) => h === "htoauths" || h === "htoauts0");
  const out: Sample[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    const t = parseTs(c[iT] ?? "");
    if (!Number.isFinite(t)) continue;
    out.push({
      t: t + stepMin * 60_000,
      precip: iP >= 0 ? num(c[iP]) : null,
      snowDepth: iS >= 0 ? num(c[iS]) : null,
      dur: stepMin * 60_000,
    });
  }
  return out;
}

export type StationSum = {
  /** mm; null wenn zu viele Lücken */
  rain: number | null;
  /** cm Neuschnee aus Schneehöhenzunahme; null wenn keine Schneehöhe gemessen */
  snow: number | null;
};

/**
 * Summe über (now-hours, now]. Fehlt mehr als 10 % der Zeit, gilt die
 * Station als lückenhaft (null) statt eine zu kleine Summe zu zeigen.
 * Neuschnee = Summe positiver Schneehöhen-Zunahmen (stündlich), damit
 * Setzung zwischen Schneefällen den Neuschnee nicht wegrechnet.
 */
export function stationWindowSum(samples: Sample[], nowMs: number, hours: number): StationSum {
  const start = nowMs - hours * 3_600_000;
  let rain = 0;
  let covered = 0;
  const depth: { t: number; d: number }[] = [];
  const sorted = samples.filter((s) => s.t > start && s.t <= nowMs).sort((a, b) => a.t - b.t);
  for (const s of sorted) {
    if (s.precip !== null) {
      rain += s.precip;
      covered += s.dur ?? 3_600_000;
    }
    if (s.snowDepth !== null) depth.push({ t: s.t, d: s.snowDepth });
  }
  const rainOk = covered >= hours * 3_600_000 * 0.9;
  let snow: number | null = null;
  if (depth.length >= 2) {
    snow = 0;
    // stündlich verdichten, damit 10-Min-Rauschen nicht aufsummiert wird
    let last = depth[0];
    for (const p of depth) {
      if (p.t - last.t < 3_600_000) continue;
      if (p.d > last.d) snow += p.d - last.d;
      last = p;
    }
  }
  return { rain: rainOk ? Math.round(rain * 10) / 10 : null, snow };
}
