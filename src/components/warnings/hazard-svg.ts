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

const SKID = `M11.2 16.4 C8.6 16.2 6.3 17.2 7.6 18.3 C9.0 19.4 11.5 19.6 10.7 20.9 C10.0 22.0 8.2 22.2 6.4 22.4`;

const SLIPPERY = `<g fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 14.4V8.9c0-.55.16-1.08.46-1.53l1.9-2.85c.31-.46.83-.74 1.39-.74h7.5c.56 0 1.08.28 1.39.74l1.9 2.85c.3.45.46.98.46 1.53v5.5c0 .36-.29.65-.65.65H5.15a.65.65 0 0 1-.65-.65z"/><path d="M7.2 8.0 8.6 5.6h6.8l1.4 2.4z"/><path d="M4.5 8.6H3.2"/><path d="M19.5 8.6h1.3"/><rect x="10.6" y="9.9" width="2.8" height="1.4" rx=".3" fill="currentColor" stroke="none"/><path d="M6.7 12.9h10.6"/><path d="M6.9 15.0v1.2"/><path d="M17.1 15.0v1.2"/><g stroke-width="1.55"><path d="${SKID}"/><g transform="translate(7.6 0)"><path d="${SKID}"/></g></g></g>`;




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
