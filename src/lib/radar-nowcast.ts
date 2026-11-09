/**
 * Radar-Nowcast: verschiebt das letzte echte Radarbild entlang der gemessenen
 * Zellverlagerung in 5-Minuten-Schritten, ohne geometrische Verformung.
 * Optionale PNGs tragen die im Ingest beobachtete Intensitätstendenz.
 * Pure Funktionen — getestet in radar-nowcast.test.ts.
 */

import { nextModelHour } from "../components/maps/radar-playback";

export type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export interface NowcastMotion {
  /** Richtung, AUS der die Zellen kommen (Grad, 0 = Nord). */
  dirFromDeg: number;
  kmh: number;
}

export const NOWCAST_STEP_MS = 5 * 60_000;
/** Messung älter als das → kein Nowcast (Verlagerung nicht mehr aktuell). */
export const NOWCAST_MAX_AGE_MS = 20 * 60_000;
/** Gleitender Horizont ab Messung: Schauer ziehen über den Stundenschlag weiter. */
export const NOWCAST_HORIZON_MS = 75 * 60_000;

/** Kein künstliches Verblassen: der Nowcast behält die gemessene Intensität bis zur Modellübergabe. */
export function nowcastIntensityFactor(_leadMinutes: number): number {
  return 1;
}

/** Convert a sampled colour band to mm/h, attenuate, then map back to bands. */
export function attenuateRadarBand(band: number, factor: number, thresholds: readonly number[]): number {
  if (factor >= 1 || band <= 0) return band;
  if (factor <= 0 || thresholds.length === 0) return 0;
  const upper = Math.min(thresholds.length, Math.max(1, Math.ceil(band)));
  const lowerValue = upper === 1 ? 0 : thresholds[upper - 2];
  const value = (lowerValue + (thresholds[upper - 1] - lowerValue) * (band - upper + 1)) * factor;
  if (value < thresholds[0]) return 0;
  for (let i = 1; i < thresholds.length; i++) {
    if (value < thresholds[i]) return i + (value - thresholds[i - 1]) / (thresholds[i] - thresholds[i - 1]);
  }
  return thresholds.length;
}

/** Only use tendency images from the exact measurement and target step. */
export function tendencyImageUrl(
  frames: { t: string; sourceT: string; precipUrl: string }[] | undefined,
  sourceMs: number,
  targetMs: number,
): string | undefined {
  return tendencyFrame(frames, sourceMs, targetMs)?.precipUrl;
}

/**
 * Stufe 2: Ist das Bild serverseitig mit dem lokalen Strömungsfeld advektiert
 * (`advected`), liegt es bereits am Zielort und darf nicht zusätzlich verschoben werden.
 */
export function nowcastPlacement(
  frame: { advected?: boolean } | undefined,
  shifted: Bbox,
  unshifted: Bbox,
): Bbox {
  return frame?.advected === true ? unshifted : shifted;
}

export function tendencyFrame<T extends { t: string; sourceT: string; precipUrl: string }>(
  frames: T[] | undefined,
  sourceMs: number,
  targetMs: number,
): T | undefined {
  // Manifest und region-max können einen Ingest-Takt (5–15 min) auseinanderliegen.
  return frames?.find((frame) => Math.abs(Date.parse(frame.sourceT) - sourceMs) <= 15 * 60_000
    && Date.parse(frame.t) === targetMs
    && typeof frame.precipUrl === "string"
    && frame.precipUrl.startsWith("https://"));
}

export function isUsableMotion(m: unknown): m is NowcastMotion {
  if (!m || typeof m !== "object") return false;
  const { dirFromDeg, kmh } = m as Record<string, unknown>;
  // Ab 0 km/h brauchbar: quasi-stationärer Stauregen bleibt an Ort und Stelle
  // stehen, statt ganz ohne Nowcast direkt zur Modellstunde zu springen.
  return (
    typeof dirFromDeg === "number" &&
    Number.isFinite(dirFromDeg) &&
    typeof kmh === "number" &&
    kmh >= 0 &&
    kmh < 120
  );
}

/** Verschiebung in Grad (Nord/Ost) nach `minutes` Minuten. */
export function displacementDeg(
  motion: NowcastMotion,
  minutes: number,
  refLat: number,
): { dLat: number; dLon: number } {
  const distKm = (motion.kmh * minutes) / 60;
  const rad = (motion.dirFromDeg * Math.PI) / 180;
  // Bewegung in Gegenrichtung zur Herkunft.
  const eastKm = -Math.sin(rad) * distKm;
  const northKm = -Math.cos(rad) * distKm;
  return {
    dLat: northKm / 111.32,
    dLon: eastKm / (111.32 * Math.cos((refLat * Math.PI) / 180)),
  };
}

export function shiftBbox(b: Bbox, d: { dLat: number; dLon: number }): Bbox {
  return {
    minLat: b.minLat + d.dLat,
    maxLat: b.maxLat + d.dLat,
    minLon: b.minLon + d.dLon,
    maxLon: b.maxLon + d.dLon,
  };
}

/**
 * Zeitpunkte + verschobene Bboxen für die Nowcast-Frames nach `lastRadarMs`.
 * Nur Zeitpunkte nach `nowMs`; leer, wenn die Messung zu alt ist.
 */
export function nowcastSteps(
  lastRadarMs: number,
  nowMs: number,
  motion: NowcastMotion,
  bbox: Bbox,
): { tMs: number; bbox: Bbox }[] {
  if (nowMs - lastRadarMs > NOWCAST_MAX_AGE_MS) return [];
  const refLat = (bbox.minLat + bbox.maxLat) / 2;
  const out: { tMs: number; bbox: Bbox }[] = [];
  // Mindestens bis zur nächsten vollen Stunde (aktuelle Zeit), sonst 75 min ab
  // Messung; das Modell übernimmt erst mit der ersten vollen Stunde danach.
  // Lückenlos bis zur vollen Modellstunde nach dem 75-min-Horizont (letzter Schritt :55).
  const HOUR = 3_600_000;
  const endMs = Math.max(nextModelHour(nowMs), Math.ceil((lastRadarMs + NOWCAST_HORIZON_MS) / HOUR) * HOUR) - 1;
  for (let dt = NOWCAST_STEP_MS; lastRadarMs + dt <= endMs; dt += NOWCAST_STEP_MS) {
    const tMs = lastRadarMs + dt;
    if (tMs <= nowMs) continue;
    out.push({ tMs, bbox: shiftBbox(bbox, displacementDeg(motion, dt / 60_000, refLat)) });
  }
  return out;
}

/** Gewicht des abklingenden Nowcasts in den ersten Modellstunden nach der Übergabe. */
export const HANDOVER_WEIGHTS = [0.6, 0.25] as const;

/**
 * Übergabe Nowcast → Modell: Für die ersten Modellstunden nach `handoverMs`
 * wird das letzte Messbild weiter verschoben und mit abnehmendem Gewicht
 * über das Modellbild gelegt, damit gemessener Niederschlag nicht schlagartig
 * verschwindet. Modellwerte selbst bleiben unverändert.
 */
export function handoverBlends(
  lastRadarMs: number,
  handoverMs: number,
  motion: NowcastMotion,
  bbox: Bbox,
): { tMs: number; bbox: Bbox; weight: number }[] {
  const refLat = (bbox.minLat + bbox.maxLat) / 2;
  return HANDOVER_WEIGHTS.map((weight, i) => {
    const tMs = handoverMs + i * 3_600_000;
    const minutes = (tMs - lastRadarMs) / 60_000;
    return { tMs, weight, bbox: shiftBbox(bbox, displacementDeg(motion, minutes, refLat)) };
  });
}
