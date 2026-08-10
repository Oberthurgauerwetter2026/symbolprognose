/**
 * Gemeinsame Blitz-Geometrie für Radar- und Satellitenkarte.
 *
 * Einzige Quelle für das Zickzack-Blitz-Symbol, damit beide Karten (und deren
 * Legenden) identisch aussehen. Farben sind parametrisiert, weil im
 * Satellitenbild die Blitze mit dem Alter von Gelb über Orange nach Dunkelrot
 * wechseln.
 */

/** Zickzack-Blitz (viewBox 0 0 24 24). */
export const BOLT_PATH = "M13.5 2 5 14h5.5L9.5 22 19 9.5h-5.8L13.5 2Z";

export interface BoltColors {
  /** Heller Kern. */
  core: string;
  /** Kontur des Kerns. */
  edge: string;
  /** Breiter Glow-Stroke + Drop-Shadow (rgb-Tripel als "r,g,b"). */
  glow: string;
  glowRgb: string;
  /** Dünne äussere Kontur (meist schwarz). */
  outline: string;
  /** Konturstärke in SVG-Einheiten (viewBox 24×24). */
  outlineWidth: number;
}

export const BOLT_YELLOW: BoltColors = {
  core: "#fffbe0",
  edge: "#ffffff",
  glow: "#fde047",
  glowRgb: "253,224,71",
  outline: "rgba(0,0,0,0.85)",
  outlineWidth: 2.5,
};

export const BOLT_RADAR: BoltColors = {
  core: "#fff59d",
  edge: "#ffffff",
  glow: "#ffeb3b",
  glowRgb: "255,235,59",
  outline: "rgba(0,0,0,0.85)",
  outlineWidth: 2.5,
};

export function boltSvg(
  size: number,
  opacity: number,
  mirrored: boolean,
  tilt: number,
  colors: BoltColors = BOLT_YELLOW,
  glowBoost: number = 1,
): string {
  const boost = Math.max(0.2, glowBoost);
  const glowOpacity = Math.min(1, opacity * 0.6 * boost).toFixed(2);
  const outerGlowOpacity = Math.min(1, opacity * 0.4 * boost).toFixed(2);
  const glowStrokeOpacity = Math.min(1, 0.4 * boost).toFixed(2);
  const glowStrokeWidth = Math.min(5, 2.5 * boost).toFixed(1);
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="overflow:visible;transform:rotate(${tilt}deg)${mirrored ? " scaleX(-1)" : ""};opacity:${opacity.toFixed(2)};filter:drop-shadow(0 0 ${(size * 0.25 * boost).toFixed(1)}px rgba(${colors.glowRgb},${glowOpacity})) drop-shadow(0 0 ${(size * 0.5 * boost).toFixed(1)}px rgba(${colors.glowRgb},${outerGlowOpacity}))">` +
    `<path d="${BOLT_PATH}" fill="none" stroke="${colors.outline}" stroke-width="${colors.outlineWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${opacity.toFixed(2)}"/>` +
    `<path d="${BOLT_PATH}" fill="${colors.glow}" stroke="${colors.glow}" stroke-width="${glowStrokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${glowStrokeOpacity}"/>` +
    `<path d="${BOLT_PATH}" fill="${colors.core}" stroke="${colors.edge}" stroke-width="0.9" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** Stabile Rotation/Spiegelung pro Einschlag (aus der Position abgeleitet). */
export function boltJitter(lat: number, lon: number): { tilt: number; mirrored: boolean } {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453);
  return {
    tilt: ((seed % 1) - 0.5) * 30,
    mirrored: Math.floor(seed) % 2 === 0,
  };
}
