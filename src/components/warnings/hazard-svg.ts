/**
 * Gemeinsame SVG-Geometrie der Gefahren-Symbole (24x24, currentColor).
 *
 * Einzige Quelle für Karte/Legende (via hazard-icons.tsx) UND für die
 * PNG-Erzeugung der Push-Benachrichtigungen (scripts/gen-warn-icons.ts).
 * Nur reines Markup – keine React-/Node-Abhängigkeiten.
 */

export const SVG_ROOT_ATTRS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const BOLT = `<path d="M14.4 1.8 5.6 13.1a.6.6 0 0 0 .48.97h4.1l-1.6 7.4a.45.45 0 0 0 .8.36l8.9-11.4a.6.6 0 0 0-.47-.97h-4.2l1.6-7.3a.45.45 0 0 0-.81-.36z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;

const drop = (cx: number, cy: number, s: number) =>
  `M ${cx} ${cy - 4.6 * s}
     C ${cx + 1.1 * s} ${cy - 2.4 * s} ${cx + 3.1 * s} ${cy - 0.9 * s} ${cx + 3.1 * s} ${cy + 0.7 * s}
     a ${3.1 * s} ${3.1 * s} 0 0 1 ${-6.2 * s} 0
     c 0 ${-1.6 * s} ${2 * s} ${-3.1 * s} ${3.1 * s} ${-5.3 * s} z`;

const RAIN = [
  drop(6.6, 7.4, 1),
  drop(17.4, 7.4, 1),
  drop(12, 16.6, 1),
]
  .map((d) => `<path d="${d}" fill="currentColor" stroke="currentColor" stroke-width="1"/>`)
  .join("");

const CRYSTAL = `<g><path d="M12 2.6v18.8"/><path d="M3.86 7.3 20.14 16.7"/><path d="M20.14 7.3 3.86 16.7"/><path d="M9.4 5.1 12 7.1l2.6-2"/><path d="M9.4 18.9 12 16.9l2.6 2"/><path d="M4.5 11.2 4.1 8.2l2.9-.9"/><path d="M19.5 12.8l.4 3-2.9.9"/><path d="M19.5 11.2l.4-3-2.9-.9"/><path d="M4.5 12.8l-.4 3 2.9.9"/></g>`;
const STAR = `<g><path d="M12 3v18"/><path d="M4.2 7.5 19.8 16.5"/><path d="M19.8 7.5 4.2 16.5"/></g>`;

const SNOW = `<g stroke-width="1.6"><g transform="translate(8.8 8.8) scale(0.68) translate(-12 -12)">${CRYSTAL}</g><g transform="translate(18.6 7.4) scale(0.28) translate(-12 -12)" stroke-width="4.6">${STAR}</g><g transform="translate(15.4 18.6) scale(0.32) translate(-12 -12)" stroke-width="4.2">${STAR}</g></g>`;

const WINDSOCK = `<path d="M4.4 3.6v17" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M6 5.1c0-.5.4-.85.9-.76l3.3.62v9.1l-3.3.62c-.5.09-.9-.26-.9-.76z" fill="currentColor" stroke="none"/><path d="M11.6 5.25 15 5.9v6.8l-3.4.65z" fill="currentColor" stroke="none"/><path d="M16.4 6.2 18.5 6.6a2.7 2.7 0 0 1 0 5.4l-2.1.4z" fill="currentColor" stroke="none"/>`;

const SLIPPERY = `<path d="M2.6 11.6v-1.1c0-.95.55-1.8 1.42-2.18l1.5-.66 1.72-2.1A2.4 2.4 0 0 1 9.06 4.7h4.6c.66 0 1.29.27 1.74.75l2.1 2.2 2.28.72c.9.28 1.52 1.12 1.52 2.07v1.16c0 .5-.4.9-.9.9H3.5a.9.9 0 0 1-.9-.9z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><rect x="5.1" y="12.5" width="3.4" height="1.7" rx="0.7" fill="currentColor" stroke="none"/><rect x="15.5" y="12.5" width="3.4" height="1.7" rx="0.7" fill="currentColor" stroke="none"/><path d="M2.9 21.6c3.4-.3 2.2-4 5.6-4.3" stroke-width="1.9"/><path d="M13.1 21.6c3.4-.3 2.2-4 5.6-4.3" stroke-width="1.9"/>`;

/** Thermometer mit Schneeflocke (Frost) – identisch zur Kartenlegende. */
const FROST = `<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="M10.585 15H10"/><path d="M2 12h6.5L10 9"/><path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h2"/>`;

/** Inneres SVG-Markup pro Gefahren-ID. */
export const HAZARD_SVG_INNER: Record<string, string> = {
  gewitter: BOLT,
  regen: RAIN,
  schnee: SNOW,
  glaette: SLIPPERY,
  wind: WINDSOCK,
  frost: FROST,
};
