import bases from '@/data/preview-bases.json';
import { DISPLAY_SCALE, FZRA_SCALE, SCALE, SLEET_SCALE, SNOW_SCALE, phaseFromAlpha } from './radar-palette';
import { windColor } from './wind-scale';

/**
 * Kachel-Standbilder der Startseite: eine einmal fotografierte Kartengrundlage
 * (scripts/build_tile_previews.py) plus die aktuellen Daten als leichte Ebene.
 * Alle Ausschnitte sind Web-Mercator-Bruchteile der Welt (0..1, Ursprung oben links).
 */
export interface PreviewView {
  w: number; h: number; x0: number; y0: number; x1: number; y1: number;
  base?: string; top?: string; wmsLayer?: string;
  /** Bildausschnitt [x0, y0, x1, y1] als Bruchteil, der sichtbar bleiben muss. */
  focus?: number[];
}
export type PreviewId = 'radar' | 'wind' | 'warn' | 'stations' | 'satellite';
export const PREVIEW_VIEWS = bases as Record<PreviewId, PreviewView>;

export const mercatorX = (lon: number) => (lon + 180) / 360;
export const mercatorY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
export const mercatorLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
export const mercatorLon = (x: number) => x * 360 - 180;

/** Lage eines Orts im Bild als Bruchteil (0..1); ausserhalb des Bilds liegen Werte <0 oder >1. */
export function previewPoint(view: PreviewView, lat: number, lon: number): { x: number; y: number } {
  return { x: (mercatorX(lon) - view.x0) / (view.x1 - view.x0), y: (mercatorY(lat) - view.y0) / (view.y1 - view.y0) };
}

/** EPSG:3857-Bbox (Meter) des Ausschnitts für eine einzelne WMS-Anfrage. */
export function previewWmsBbox(view: PreviewView): string {
  const R = 20037508.342789244;
  return [view.x0 * 2 * R - R, R - view.y1 * 2 * R, view.x1 * 2 * R - R, R - view.y0 * 2 * R].map(v => v.toFixed(2)).join(',');
}

export interface GeoBox { minLat: number; maxLat: number; minLon: number; maxLon: number }
export interface Pixels { w: number; h: number; data: Uint8ClampedArray }

const phaseRgb = (phase: number, mmh: number, rain: [number, number, number]): [number, number, number] => {
  const strong = mmh >= 2 ? 1 : 0;
  if (phase === 3) return FZRA_SCALE[strong]!.rgb;
  if (phase === 2) return SNOW_SCALE[strong]!.rgb;
  if (phase === 1) return SLEET_SCALE[strong]!.rgb;
  return rain;
};

/**
 * Färbt ein Radar-Messbild wie die grosse Karte (gleiche Stufen, gleiche
 * Phasenfarben) in das Raster des Kachelausschnitts. Stufen werden über den
 * Bandindex geglättet, damit keine Blöcke entstehen; transparente Pixel bleiben leer.
 */
export function renderRadarStill(src: Pixels, box: GeoBox, view: PreviewView, outW: number, outH: number): Uint8ClampedArray {
  const { w, h, data } = src;
  const band = new Float32Array(w * h);
  const phase = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, a = data[o + 3]!;
    if (a < 8) continue;
    let best = Infinity, index = 0;
    for (let s = 0; s < SCALE.length; s++) {
      const rgb = SCALE[s]!.rgb;
      const d = (data[o]! - rgb[0]) ** 2 + (data[o + 1]! - rgb[1]) ** 2 + (data[o + 2]! - rgb[2]) ** 2;
      if (d < best) { best = d; index = s + 1; }
    }
    band[i] = index;
    phase[i] = phaseFromAlpha(a);
  }
  const smooth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      sum += band[yy * w + xx]!; count++;
    }
    smooth[y * w + x] = sum / count;
  }
  const out = new Uint8ClampedArray(outW * outH * 4);
  const lonSpan = box.maxLon - box.minLon, latSpan = box.maxLat - box.minLat;
  for (let py = 0; py < outH; py++) {
    const lat = mercatorLat(view.y0 + ((py + 0.5) / outH) * (view.y1 - view.y0));
    const fy = ((box.maxLat - lat) / latSpan) * (h - 1);
    if (fy < 0 || fy > h - 1) continue;
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let px = 0; px < outW; px++) {
      const lon = mercatorLon(view.x0 + ((px + 0.5) / outW) * (view.x1 - view.x0));
      const fx = ((lon - box.minLon) / lonSpan) * (w - 1);
      if (fx < 0 || fx > w - 1) continue;
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const v = smooth[y0 * w + x0]! * (1 - tx) * (1 - ty) + smooth[y0 * w + x1]! * tx * (1 - ty) + smooth[y1 * w + x0]! * (1 - tx) * ty + smooth[y1 * w + x1]! * tx * ty;
      if (v < 0.5) continue;
      const step = DISPLAY_SCALE[Math.min(DISPLAY_SCALE.length, Math.max(1, Math.round(v))) - 1]!;
      const [r, g, b] = phaseRgb(phase[Math.round(fy) * w + Math.round(fx)]!, step.mmh, step.rgb);
      const o = (py * outW + px) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(step.a * 255);
    }
  }
  return out;
}

export interface WindNow { t: string; gridLat: number[]; gridLon: number[]; gust: number[]; speed: number[]; dir: number[] }

/** Bilinearer Wert eines zeilenweise (Breite × Länge) gespeicherten Felds; ausserhalb des Gitters null. */
export function sampleGrid(field: number[], gridLat: number[], gridLon: number[], lat: number, lon: number, nearest = false): number | null {
  const nLat = gridLat.length, nLon = gridLon.length;
  if (nLat < 2 || nLon < 2) return null;
  const fy = ((lat - gridLat[0]!) / (gridLat[nLat - 1]! - gridLat[0]!)) * (nLat - 1);
  const fx = ((lon - gridLon[0]!) / (gridLon[nLon - 1]! - gridLon[0]!)) * (nLon - 1);
  if (fx < 0 || fy < 0 || fx > nLon - 1 || fy > nLat - 1) return null;
  if (nearest) return field[Math.round(fy) * nLon + Math.round(fx)] ?? null;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(nLon - 1, x0 + 1), y1 = Math.min(nLat - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const at = (y: number, x: number) => field[y * nLon + x] ?? 0;
  return at(y0, x0) * (1 - tx) * (1 - ty) + at(y0, x1) * tx * (1 - ty) + at(y1, x0) * (1 - tx) * ty + at(y1, x1) * tx * ty;
}

/** Böen-Farbfläche der aktuellen Stunde im Raster des Kachelausschnitts (Farben wie die Windkarte). */
export function renderWindStill(wind: WindNow, view: PreviewView, outW: number, outH: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let py = 0; py < outH; py++) {
    const lat = mercatorLat(view.y0 + ((py + 0.5) / outH) * (view.y1 - view.y0));
    for (let px = 0; px < outW; px++) {
      const gust = sampleGrid(wind.gust, wind.gridLat, wind.gridLon, lat, mercatorLon(view.x0 + ((px + 0.5) / outW) * (view.x1 - view.x0)));
      if (gust === null) continue;
      const [r, g, b] = windColor(gust);
      const o = (py * outW + px) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return out;
}
