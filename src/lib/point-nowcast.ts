export type PrecipPhase = 'dry' | 'rain' | 'sleet' | 'snow' | 'freezing-rain';
export type PointSample = { t: number; phase: PrecipPhase | null };
export type PointOutlook = { phase: PrecipPhase; minutes: number; horizon: number };
export type PointRadarFrame = { t: number; url: string; bbox?: PointRadarData['bbox']; shifted?: boolean };
export type PointRadarData = {
  sourceT: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  frames: PointRadarFrame[];
  phaseUrl?: string;
  measurementUrl?: string;
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
  if (outlook.phase === 'dry') return `Voraussichtlich trocken in den nächsten ${outlook.horizon} Min.`;
  const names = { rain: 'Regen', sleet: 'Schneeregen', snow: 'Schnee', 'freezing-rain': 'Gefrierender Regen' };
  return outlook.minutes === 0 ? `${names[outlook.phase]} aktuell` : `${names[outlook.phase]} in ca. ${outlook.minutes} Min.`;
}

/** Conservative distance to precipitation OR the image edge; inspect every native pixel. */
export function radarDryRadiusKm(rgba: Uint8ClampedArray, width: number, height: number, bbox: PointRadarData['bbox'], location: { lat: number; lon: number }): number | null {
  if (width < 2 || height < 2 || rgba.length !== width * height * 4 ||
    ![location.lat, location.lon, bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon].every(Number.isFinite) ||
    bbox.maxLat <= bbox.minLat || bbox.maxLon <= bbox.minLon ||
    location.lat <= bbox.minLat || location.lat >= bbox.maxLat || location.lon <= bbox.minLon || location.lon >= bbox.maxLon) return null;
  const latKm = 111.32;
  const lonKm = latKm * Math.cos(Math.max(Math.abs(bbox.minLat), Math.abs(bbox.maxLat)) * Math.PI / 180);
  if (lonKm <= 0) return null;
  let radius = Math.min((location.lat - bbox.minLat) * latKm, (bbox.maxLat - location.lat) * latKm,
    (location.lon - bbox.minLon) * lonKm, (bbox.maxLon - location.lon) * lonKm);
  const dx = (bbox.maxLon - bbox.minLon) * lonKm / (width - 1);
  const dy = (bbox.maxLat - bbox.minLat) * latKm / (height - 1);
  const pixelMargin = Math.hypot(dx, dy) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha === undefined) return null;
      if (alpha === 0) continue;
      const east = (bbox.minLon - location.lon) * lonKm + x * dx;
      const north = (bbox.maxLat - location.lat) * latKm - y * dy;
      radius = Math.min(radius, Math.max(0, Math.hypot(east, north) - pixelMargin));
    }
  }
  return Math.max(0, radius - pixelMargin);
}

/** Dry fallback only for absent nowcasts; allow 100 km/h approach, including observation age. */
export function regionalDryOutlook(radiusKm: number | null, sourceT: number, now: number): PointOutlook | null {
  if (radiusKm === null || !Number.isFinite(radiusKm) || !Number.isFinite(sourceT) || !Number.isFinite(now) || sourceT > now || now - sourceT > 20 * MINUTE) return null;
  const ageMinutes = (now - sourceT) / MINUTE;
  for (const horizon of [60, 30]) {
    if (radiusKm >= (horizon + ageMinutes) * 100 / 60) return { phase: 'dry', minutes: 0, horizon };
  }
  return null;
}