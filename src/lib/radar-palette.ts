/**
 * Radar-Farbskalen und Phasen-Kodierung – gemeinsam für die grosse Radarkarte
 * und das Standbild der Startseiten-Kachel, damit beide identisch färben.
 * SCALE MUSS exakt zu PRECIP_SCALE in scripts/ingest_radar.py passen (Decode-
 * Referenz der PNG-Farben); DISPLAY_SCALE ist die weichere Anzeige-Palette.
 * Alpha-Codes der Phase MÜSSEN zu scripts/_phase.py passen:
 * 245/255 = Regen, 230 = Schneeregen, 215 = Schnee, 200 = gefrierender Regen.
 */
export const SCALE: { mmh: number; rgb: [number, number, number]; a: number }[] = [
  { mmh: 0.1,   rgb: [120, 180, 235], a: 245 / 255 },
  { mmh: 0.3,   rgb: [ 95, 155, 220], a: 255 / 255 },
  { mmh: 0.8,   rgb: [ 40,  90, 195], a: 255 / 255 },
  { mmh: 2,     rgb: [ 55, 170,  75], a: 255 / 255 },
  { mmh: 5,     rgb: [245, 220,  55], a: 255 / 255 },
  { mmh: 15,    rgb: [240, 140,  35], a: 255 / 255 },
  { mmh: 40,    rgb: [220,  40,  40], a: 255 / 255 },
  { mmh: 80,    rgb: [170,  40, 180], a: 255 / 255 },
];

export const DISPLAY_SCALE: { mmh: number; rgb: [number, number, number]; a: number }[] = [
  { mmh: 0.1,   rgb: [134, 188, 236], a: 245 / 255 },
  { mmh: 0.3,   rgb: [109, 162, 222], a: 255 / 255 },
  { mmh: 0.8,   rgb: [ 66, 111, 200], a: 255 / 255 },
  { mmh: 2,     rgb: [ 80, 178,  96], a: 255 / 255 },
  { mmh: 5,     rgb: [243, 215,  81], a: 255 / 255 },
  { mmh: 15,    rgb: [239, 152,  61], a: 255 / 255 },
  { mmh: 40,    rgb: [222,  72,  66], a: 255 / 255 },
  { mmh: 80,    rgb: [177,  72, 187], a: 255 / 255 },
];

export const SNOW_SCALE: { mmh: number; rgb: [number, number, number]; label: string }[] = [
  { mmh: 0.1, rgb: [210, 194, 232], label: "leicht" },
  { mmh: 2, rgb: [164, 134, 214], label: "stark" },
];

export const SLEET_SCALE: { mmh: number; rgb: [number, number, number]; label: string }[] = [
  { mmh: 0.1, rgb: [176, 192, 212], label: "leicht" },
  { mmh: 2, rgb: [112, 134, 166], label: "stark" },
];

export const FZRA_SCALE: { mmh: number; rgb: [number, number, number]; label: string }[] = [
  { mmh: 0.1, rgb: [244, 114, 182], label: "leicht" },
  { mmh: 2, rgb: [219, 39, 119], label: "stark" },
];

export function phaseFromAlpha(a: number): number {
  if (Math.abs(a - 200) <= 3) return 3;
  if (Math.abs(a - 230) <= 3) return 1;
  if (Math.abs(a - 215) <= 3) return 2;
  return 0;
}
