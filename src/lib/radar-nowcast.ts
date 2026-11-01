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

/** Only use tendency images from the exact measurement and target step. */
export function tendencyImageUrl(
  frames: { t: string; sourceT: string; precipUrl: string }[] | undefined,
  sourceMs: number,
  targetMs: number,
): string | undefined {
  return frames?.find((frame) => Date.parse(frame.sourceT) === sourceMs
    && Date.parse(frame.t) === targetMs
    && typeof frame.precipUrl === "string"
    && frame.precipUrl.startsWith("https://"))?.precipUrl;
}

export function isUsableMotion(m: unknown): m is NowcastMotion {
  if (!m || typeof m !== "object") return false;
  const { dirFromDeg, kmh } = m as Record<string, unknown>;
  return (
    typeof dirFromDeg === "number" &&
    Number.isFinite(dirFromDeg) &&
    typeof kmh === "number" &&
    kmh >= 5 &&
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
  // Aktuelle Stunde, nicht die des verspäteten Messbilds: dort übernimmt das Modell.
  const hourEnd = nextModelHour(nowMs);
  for (let dt = NOWCAST_STEP_MS; lastRadarMs + dt < hourEnd; dt += NOWCAST_STEP_MS) {
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
