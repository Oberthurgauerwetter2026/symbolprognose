/**
 * Erzeugt die PNG-Symbole für Push-Benachrichtigungen aus derselben
 * SVG-Geometrie wie die Warnkarte (src/components/warnings/hazard-svg.ts).
 *
 * Aufruf:  bun scripts/gen-warn-icons.ts
 * Ergebnis: /tmp/warn-icons-svg/<hazard>-<level>.svg  (Rasterung via Playwright)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { HAZARD_SVG_INNER, SVG_ROOT_ATTRS } from "../src/components/warnings/hazard-svg";

const LEVEL_COLOR: Record<number, string> = {
  1: "#f2c53d",
  2: "#ef8b30",
  3: "#d63b32",
};
/** Symbolfarbe: auf Gelb/Orange dunkel, auf Rot weiss (wie Kartenbeschriftung). */
const FG: Record<number, string> = { 1: "#20242b", 2: "#20242b", 3: "#ffffff" };

const SIZE = 192;
const OUT = "/tmp/warn-icons-svg";
mkdirSync(OUT, { recursive: true });

for (const hazard of Object.keys(HAZARD_SVG_INNER)) {
  for (const level of [1, 2, 3]) {
    const inner = HAZARD_SVG_INNER[hazard]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.22}" fill="${LEVEL_COLOR[level]}"/>
  <g transform="translate(${SIZE * 0.18} ${SIZE * 0.18}) scale(${(SIZE * 0.64) / 24})">
    <svg viewBox="${SVG_ROOT_ATTRS.viewBox}" width="24" height="24" fill="none" stroke="${FG[level]}" stroke-width="${SVG_ROOT_ATTRS.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" color="${FG[level]}">${inner}</svg>
  </g>
</svg>`;
    writeFileSync(`${OUT}/${hazard}-${level}.svg`, svg);
  }
}
console.log("SVGs geschrieben nach", OUT);
