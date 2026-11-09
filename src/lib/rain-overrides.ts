/**
 * Manuelle Tagessummen (Weather Hub `rain_daily_overrides`) auf 10-Minuten-Werte anwenden.
 * Die Werte eines Tages (Zürcher Kalendertag) werden proportional skaliert, damit ihre
 * Summe der Korrektur entspricht; ohne gemessenen Regen wird die Summe gleichmässig verteilt.
 */
import type { Sample } from "./station-sums";

export type DailyOverride = { day: string; rain_sum: number };

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
export const zurichDay = (t: number) => fmt.format(new Date(t));

export function applyDailyOverrides(samples: Sample[], overrides: DailyOverride[]): Sample[] {
  if (!overrides.length) return samples;
  const target = new Map(overrides.filter((o) => Number.isFinite(o.rain_sum) && o.rain_sum >= 0).map((o) => [o.day, o.rain_sum]));
  const byDay = new Map<string, number[]>();
  samples.forEach((s, i) => {
    const d = zurichDay(s.t);
    if (!target.has(d)) return;
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(i);
  });
  const out = samples.map((s) => ({ ...s }));
  for (const [d, idx] of byDay) {
    const want = target.get(d)!;
    const raw = idx.reduce((a, i) => a + (out[i].precip ?? 0), 0);
    for (const i of idx) {
      out[i].precip = raw > 0 ? (out[i].precip ?? 0) * (want / raw) : want / idx.length;
    }
  }
  return out;
}
