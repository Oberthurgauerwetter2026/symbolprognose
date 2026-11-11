// Weicher, reliefgetreuer Phasenübergang im Radar: statt harter Stufen
// (Regen/Schneeregen/Schnee) wird die bilinear interpolierte Phasenwertung
// (0 Regen, 0.5 Schneeregen, 1 Schnee) in einem schmalen Band überblendet.
export type RGB = [number, number, number];

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Farbe für eine Phasenwertung; Übergangsbänder um 0.25 und 0.75 (±0.1). */
export function blendPhaseRgb(score: number, rain: RGB, sleet: RGB, snow: RGB): RGB {
  if (score <= 0.15) return rain;
  if (score >= 0.85) return snow;
  if (score < 0.5) return mix(rain, sleet, smooth(0.15, 0.35, score));
  return mix(sleet, snow, smooth(0.65, 0.85, score));
}

/** Symbole (Flocken/Tropfen) nur im Kern einer Phase, nie im Übergangsband. */
export function phaseCore(score: number): 0 | 1 | 2 | null {
  if (score <= 0.1) return 0;
  if (score >= 0.9) return 2;
  if (score >= 0.4 && score <= 0.6) return 1;
  return null;
}
