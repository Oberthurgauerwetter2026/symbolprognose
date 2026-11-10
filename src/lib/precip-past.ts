/** Reine Summenlogik für die gefallenen Niederschläge (getestet). */
export const PAST_WINDOWS = [12, 24, 48, 72] as const;
export type PastWindow = (typeof PAST_WINDOWS)[number];

/**
 * Summiert stündliche Werte, deren Stunde vollständig im Fenster
 * (now - hours, now] liegt. Open-Meteo-Stundenwerte gelten für die Stunde,
 * die zum Zeitstempel endet. Fehlende Werte zählen nicht als 0-Messung,
 * sondern werden übersprungen.
 */
export function sumPastHours(
  timesMs: number[],
  values: (number | null)[],
  nowMs: number,
  hours: number,
): number {
  const start = nowMs - hours * 3_600_000;
  let sum = 0;
  for (let i = 0; i < timesMs.length; i++) {
    const t = timesMs[i];
    if (t <= start || t > nowMs) continue;
    const v = values[i];
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  return sum;
}

/**
 * Prognosesumme: stündliche Werte im Fenster (now, now + hours].
 * Die laufende Stunde zählt anteilig nicht – nur Stunden, die nach `now` enden.
 */
export function sumNextHours(
  timesMs: number[],
  values: (number | null)[],
  nowMs: number,
  hours: number,
): number {
  const end = nowMs + hours * 3_600_000;
  let sum = 0;
  for (let i = 0; i < timesMs.length; i++) {
    const t = timesMs[i];
    if (t <= nowMs || t > end) continue;
    const v = values[i];
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  return sum;
}

/** Neuschnee nur zählen, wenn es am Boden physikalisch schneien kann:
 *  2-m-Temperatur ≤ 1.5 °C und Nullgradgrenze höchstens 400 m über Grund. */
export function gateSnowfall(
  snow: (number | null)[],
  temp: (number | null)[] | undefined,
  fzl: (number | null)[] | undefined,
  elevation: number | undefined,
): (number | null)[] {
  if (!temp) return snow;
  return snow.map((s, i) => {
    if (s == null || s <= 0) return s;
    const t = temp[i];
    if (t == null) return s;
    if (t > 1.5) return 0;
    const f = fzl?.[i];
    if (f != null && elevation != null && f - elevation > 400) return 0;
    return s;
  });
}
