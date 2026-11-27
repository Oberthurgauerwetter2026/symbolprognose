export type PrecipPhase = 'dry' | 'rain' | 'sleet' | 'snow' | 'freezing-rain';
export type PointSample = { t: number; phase: PrecipPhase | null };
export type PointOutlook = { phase: PrecipPhase; minutes: number; horizon: number };
export type PointRadarFrame = { t: number; url: string; bbox?: PointRadarData['bbox']; shifted?: boolean };
export type PointRadarData = {
  sourceT: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  frames: PointRadarFrame[];
  phaseUrl?: string;
};
const MINUTE = 60_000;

/** Native categorical PNG alpha, identical to the radar's phase codes. */
export function pointPhase(alpha: number): PrecipPhase {
  if (alpha === 0) return 'dry';
  if (Math.abs(alpha - 200) <= 3) return 'freezing-rain';
  if (Math.abs(alpha - 215) <= 3) return 'snow';
  if (Math.abs(alpha - 230) <= 3) return 'sleet';
  return 'rain';
}

/** No dry claim without uninterrupted, fresh measured/advected coverage. */
export function pointOutlook(samples: PointSample[], sourceT: number, now: number): PointOutlook | null {
  if (!Number.isFinite(sourceT) || now - sourceT > 20 * MINUTE || sourceT > now) return null;
  const slots = samples.filter(s => s.t >= now - 5 * MINUTE && s.t <= now + 65 * MINUTE).sort((a, b) => a.t - b.t);
  const first = slots[0];
  if (!first || first.t > now + 5 * MINUTE || first.phase === null) return null;
  let previous = first;
  for (const sample of slots) {
    if (sample.phase === null || sample.t - previous.t > 5 * MINUTE) break;
    const minutes = Math.max(0, Math.round((sample.t - now) / MINUTE / 5) * 5);
    if (sample.phase !== 'dry' && sample.t <= now + 60 * MINUTE) return { phase: sample.phase, minutes, horizon: 60 };
    previous = sample;
  }
  const covered = previous.t - now;
  if (covered >= 60 * MINUTE) return { phase: 'dry', minutes: 0, horizon: 60 };
  if (covered >= 30 * MINUTE) return { phase: 'dry', minutes: 0, horizon: 30 };
  return null;
}

export function pointOutlookLabel(outlook: PointOutlook | null): string {
  if (!outlook) return 'Radar-Ausblick nicht verfügbar';
  if (outlook.phase === 'dry') return `Voraussichtlich ${outlook.horizon} Min. trocken`;
  const names = { rain: 'Regen', sleet: 'Schneeregen', snow: 'Schnee', 'freezing-rain': 'Gefrierender Regen' };
  return outlook.minutes === 0 ? `${names[outlook.phase]} aktuell` : `${names[outlook.phase]} in ca. ${outlook.minutes} Min.`;
}