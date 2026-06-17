/**
 * MeteoSwiss-Pictogramm-Spec.
 *
 * Pro MCH-Code (1–35 Tag / 101–135 Nacht) liefert `renderMchInnerSvg(code)`
 * den inneren SVG-Markup (Layer-Komposition) im viewBox 0 0 64 64.
 * Nacht-Codes (≥ 100) tauschen Sonne gegen Mond, alles andere bleibt
 * identisch — analog zur MeteoSwiss-Logik (die Pictogramme unterscheiden
 * sich zwischen Tag und Nacht nur in Sonne/Mond).
 *
 * Ziel: 1:1-Symbolik pro MCH-Code statt heuristisches Mapping auf
 * generische Icons. Reine SVG-Strings, identisch im Client (React via
 * dangerouslySetInnerHTML) und Server-SVG-Pfad (noscript/Snapshot).
 */

const C = {
  sun: "#fbbf24",
  sunStroke: "#f59e0b",
  moon: "#e5e7eb",
  moonStroke: "#cbd5e1",
  cloud: "#cbd5e1",
  cloudEdge: "#94a3b8",
  cloudDark: "#64748b",
  cloudDarkEdge: "#475569",
  rain: "#38bdf8",
  snow: "#e0f2fe",
  snowStroke: "#7dd3fc",
  bolt: "#facc15",
  boltStroke: "#ca8a04",
  fog: "#94a3b8",
  wind: "#64748b",
  sand: "#d6a86b",
};

// ---------- Primitive layers ----------

function sun(cx = 32, cy = 22, r = 9): string {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      const x1 = (cx + Math.cos(rad) * (r + 3)).toFixed(1);
      const y1 = (cy + Math.sin(rad) * (r + 3)).toFixed(1);
      const x2 = (cx + Math.cos(rad) * (r + 7)).toFixed(1);
      const y2 = (cy + Math.sin(rad) * (r + 7)).toFixed(1);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.sun}" stroke-width="2.5" stroke-linecap="round"/>`;
    })
    .join("");
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.sun}" stroke="${C.sunStroke}" stroke-width="1"/>${rays}`;
}

function moon(cx = 32, cy = 22, r = 10): string {
  // Crescent via two arcs (path).
  const x0 = cx + r * 0.2;
  const y0 = cy - r;
  return `<path d="M ${x0} ${y0} a ${r} ${r} 0 1 0 0 ${2 * r} a ${r * 0.78} ${r * 0.78} 0 1 1 0 ${-2 * r} z" fill="${C.moon}" stroke="${C.moonStroke}" stroke-width="1"/>`;
}

function cloud(
  x = 32,
  y = 38,
  scale = 1,
  dark = false,
): string {
  const fill = dark ? C.cloudDark : C.cloud;
  const stroke = dark ? C.cloudDarkEdge : C.cloudEdge;
  // Bumpy cloud, base on y, width ~36*scale
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M -18 6 Q -22 6 -22 0 Q -22 -8 -14 -8 Q -12 -14 -4 -14 Q 6 -16 10 -10 Q 18 -10 18 -2 Q 22 6 14 6 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
}

function rainDrops(positions: number[], yBase = 46, len = 6): string {
  return positions
    .map(
      (x) =>
        `<line x1="${x}" y1="${yBase}" x2="${x - 2}" y2="${yBase + len}" stroke="${C.rain}" stroke-width="2.2" stroke-linecap="round"/>`,
    )
    .join("");
}

function snowFlakes(positions: number[], yBase = 50): string {
  return positions
    .map((x) => {
      const r = 2.2;
      return `<g transform="translate(${x} ${yBase})"><line x1="0" y1="${-r}" x2="0" y2="${r}" stroke="${C.snowStroke}" stroke-width="1.6" stroke-linecap="round"/><line x1="${-r}" y1="0" x2="${r}" y2="0" stroke="${C.snowStroke}" stroke-width="1.6" stroke-linecap="round"/><line x1="${-r * 0.7}" y1="${-r * 0.7}" x2="${r * 0.7}" y2="${r * 0.7}" stroke="${C.snowStroke}" stroke-width="1.6" stroke-linecap="round"/><line x1="${-r * 0.7}" y1="${r * 0.7}" x2="${r * 0.7}" y2="${-r * 0.7}" stroke="${C.snowStroke}" stroke-width="1.6" stroke-linecap="round"/></g>`;
    })
    .join("");
}

function lightning(x = 32, y = 46, double = false): string {
  const bolt = (cx: number) =>
    `<path d="M ${cx} ${y} l -4 7 l 3 1 l -2 6 l 6 -8 l -3 -1 l 3 -5 z" fill="${C.bolt}" stroke="${C.boltStroke}" stroke-width="0.8" stroke-linejoin="round"/>`;
  return double ? bolt(x - 6) + bolt(x + 6) : bolt(x);
}

function fog(yBase = 36): string {
  return [0, 8, 16, 24]
    .map(
      (dy) =>
        `<line x1="10" y1="${yBase + dy}" x2="54" y2="${yBase + dy}" stroke="${C.fog}" stroke-width="3" stroke-linecap="round"/>`,
    )
    .join("");
}

function fogHigh(): string {
  // dichte obere Schicht + freie Sicht unten
  return `<rect x="6" y="18" width="52" height="14" rx="7" fill="${C.fog}" opacity="0.85"/><line x1="10" y1="42" x2="54" y2="42" stroke="${C.fog}" stroke-width="2" stroke-linecap="round" opacity="0.5"/><line x1="14" y1="48" x2="50" y2="48" stroke="${C.fog}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`;
}

function wind(yBase = 40): string {
  return `<path d="M 8 ${yBase} h 28 a 5 5 0 1 0 -5 -5" fill="none" stroke="${C.wind}" stroke-width="2.5" stroke-linecap="round"/><path d="M 8 ${yBase + 10} h 36 a 6 6 0 1 0 -6 -6" fill="none" stroke="${C.wind}" stroke-width="2.5" stroke-linecap="round"/>`;
}

function sandDust(): string {
  // wirbelnde horizontale Striche in Sandfarbe
  return `<line x1="8"  y1="36" x2="56" y2="36" stroke="${C.sand}" stroke-width="3" stroke-linecap="round"/><line x1="14" y1="44" x2="50" y2="44" stroke="${C.sand}" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="52" x2="54" y2="52" stroke="${C.sand}" stroke-width="3" stroke-linecap="round"/>`;
}

// ---------- Per-code composition ----------

function composeDay(code: number): string {
  switch (code) {
    case 1: // sonnig
      return sun(32, 32, 12);
    case 2: // leicht bewölkt
      return sun(22, 20, 8) + cloud(38, 40, 0.75);
    case 3: // bewölkt
      return sun(20, 20, 8) + cloud(36, 40, 1);
    case 4: // stark bewölkt
      return cloud(22, 30, 0.7, false) + cloud(38, 42, 1, false);
    case 5: // bedeckt
      return cloud(32, 36, 1.15, true);
    case 6: // leichter Regen
      return cloud(32, 30, 1) + rainDrops([26, 38], 44, 6);
    case 7: // Regen
      return cloud(32, 30, 1) + rainDrops([22, 32, 42], 44, 8);
    case 8: // starker Regen
      return cloud(32, 30, 1.05, true) + rainDrops([20, 28, 36, 44], 44, 10);
    case 9: // Regenschauer
      return sun(20, 18, 7) + cloud(36, 32, 1) + rainDrops([30, 40], 46, 8);
    case 10: // Schnee
      return cloud(32, 30, 1) + snowFlakes([24, 32, 40], 48);
    case 11: // Schneeschauer
      return sun(20, 18, 7) + cloud(36, 32, 1) + snowFlakes([32, 42], 48);
    case 12: // Gewitter
      return cloud(32, 30, 1.05, true) + lightning(32, 42) + rainDrops([22, 44], 44, 8);
    case 13: // starkes Gewitter
      return (
        cloud(32, 30, 1.1, true) +
        lightning(32, 42, true) +
        rainDrops([18, 46], 44, 10)
      );
    case 14: // leichter Schneefall
      return cloud(32, 30, 1) + snowFlakes([28, 38], 48);
    case 15: // Schneefall
      return cloud(32, 30, 1) + snowFlakes([22, 32, 42], 48);
    case 16: // starker Schneefall
      return (
        cloud(32, 30, 1.05, true) + snowFlakes([20, 28, 36, 44], 48) + snowFlakes([24, 40], 56)
      );
    case 17: // Regen und Schnee
      return cloud(32, 30, 1) + rainDrops([24, 40], 46, 8) + snowFlakes([32], 50);
    case 18: // starker Regen und Schnee
      return (
        cloud(32, 30, 1.05, true) +
        rainDrops([22, 42], 46, 9) +
        snowFlakes([28, 36], 52)
      );
    case 19: // Schneeregenschauer
      return (
        sun(20, 18, 7) + cloud(36, 32, 1) + rainDrops([32], 48, 7) + snowFlakes([42], 50)
      );
    case 20: // starker Schneeschauer
      return (
        sun(20, 18, 7) + cloud(36, 32, 1) + snowFlakes([30, 38, 46], 48)
      );
    case 21: // leichter Schneeregen
      return cloud(32, 30, 1) + rainDrops([28], 46, 6) + snowFlakes([38], 50);
    case 22: // Schneeschauer (dichter)
      return cloud(32, 30, 1.05, true) + snowFlakes([24, 32, 40], 48);
    case 23: // Schneeregenschauer (dichter)
      return (
        cloud(32, 30, 1.05, true) +
        rainDrops([24, 42], 46, 8) +
        snowFlakes([32], 52)
      );
    case 24: // Gewitter mit Regen
      return (
        cloud(32, 30, 1.05, true) +
        lightning(28, 42) +
        rainDrops([22, 38, 46], 44, 8)
      );
    case 25: // starkes Gewitter
      return (
        cloud(32, 28, 1.15, true) +
        lightning(32, 42, true) +
        rainDrops([18, 30, 46], 46, 10)
      );
    case 26: // leicht bewölkt (variabel)
      return sun(22, 20, 8) + cloud(42, 42, 0.6);
    case 27: // wechselnd bewölkt
      return sun(20, 22, 8) + cloud(40, 38, 0.85) + cloud(14, 44, 0.5);
    case 28: // stark bewölkt (variabel)
      return cloud(20, 30, 0.65) + cloud(40, 40, 1);
    case 29: // bedeckt mit etwas Regen
      return cloud(32, 32, 1.1, true) + rainDrops([28], 46, 6);
    case 30: // Nebel
      return fog(22);
    case 31: // Sturm
      return (
        cloud(32, 26, 1.05, true) + rainDrops([20, 30, 40, 48], 42, 10) + wind(50)
      );
    case 32: // Wind
      return wind(28);
    case 33: // Hochnebel
      return fogHigh();
    case 34: // Bise / Sandsturm
      return sandDust();
    case 35: // Schneesturm
      return (
        cloud(32, 26, 1.05, true) +
        snowFlakes([22, 30, 38, 46], 44) +
        wind(52)
      );
    default:
      return cloud(32, 36, 1.1);
  }
}

function composeNight(code: number): string {
  // Map: codes with sun → swap sun for moon, others identical.
  switch (code) {
    case 1: // klare Nacht
      return moon(32, 32, 12);
    case 2:
      return moon(22, 20, 9) + cloud(38, 40, 0.75);
    case 3:
      return moon(20, 20, 9) + cloud(36, 40, 1);
    case 9:
      return moon(20, 18, 8) + cloud(36, 32, 1) + rainDrops([30, 40], 46, 8);
    case 11:
      return moon(20, 18, 8) + cloud(36, 32, 1) + snowFlakes([32, 42], 48);
    case 19:
      return (
        moon(20, 18, 8) + cloud(36, 32, 1) + rainDrops([32], 48, 7) + snowFlakes([42], 50)
      );
    case 20:
      return moon(20, 18, 8) + cloud(36, 32, 1) + snowFlakes([30, 38, 46], 48);
    case 26:
      return moon(22, 20, 9) + cloud(42, 42, 0.6);
    case 27:
      return moon(20, 22, 9) + cloud(40, 38, 0.85) + cloud(14, 44, 0.5);
    default:
      return composeDay(code);
  }
}

export function renderMchInnerSvg(code: number): string {
  if (!Number.isFinite(code)) return composeDay(3);
  if (code >= 100) return composeNight(code - 100);
  return composeDay(code);
}

const LABELS: Record<number, string> = {
  1: "sonnig",
  2: "leicht bewölkt",
  3: "bewölkt",
  4: "stark bewölkt",
  5: "bedeckt",
  6: "leichter Regen",
  7: "Regen",
  8: "starker Regen",
  9: "Regenschauer",
  10: "Schnee",
  11: "Schneeschauer",
  12: "Gewitter",
  13: "starkes Gewitter",
  14: "leichter Schneefall",
  15: "Schneefall",
  16: "starker Schneefall",
  17: "Regen und Schnee",
  18: "starker Regen und Schnee",
  19: "Schneeregenschauer",
  20: "starker Schneeschauer",
  21: "leichter Schneeregen",
  22: "Schneeschauer",
  23: "Schneeregenschauer",
  24: "Gewitter mit Regen",
  25: "starkes Gewitter",
  26: "leicht bewölkt",
  27: "wechselnd bewölkt",
  28: "stark bewölkt",
  29: "bedeckt mit Regen",
  30: "Nebel",
  31: "Sturm",
  32: "Wind",
  33: "Hochnebel",
  34: "Bise",
  35: "Schneesturm",
};

export function mchLabel(code: number): string {
  const night = code >= 100;
  const base = LABELS[night ? code - 100 : code] ?? "Wetter";
  if (night && (code === 101)) return "klare Nacht";
  return night ? `${base} (Nacht)` : base;
}

export function renderMchSvg(code: number, size = 48): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${mchLabel(code)}">${renderMchInnerSvg(code)}</svg>`;
}
