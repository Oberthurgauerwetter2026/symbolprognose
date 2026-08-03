/**
 * Bewegungsfeld-Schätzung und Advektion für die Niederschlagsprognose.
 *
 * Ziel: Zwischen zwei Modellzeitpunkten wird kein linearer Cross-Fade
 * gerechnet, sondern ein Bewegungsfeld (Kreuzkorrelation als Startwert +
 * Horn–Schunck-Verfeinerung auf einer Bildpyramide). Die Felder werden entlang
 * dieses Flusses advectiert, sodass Form und Struktur der Zellen erhalten
 * bleiben. Nur die Intensität wird sanft interpoliert.
 *
 * Alle Funktionen arbeiten auf den im Client dekodierten mm/h-Rastern
 * (row-major, Zeile 0 = maxLat) — kein Backend/Ingest-Eingriff.
 */

export interface FlowField {
  /** Verschiebung in Pixel pro vollem Modellintervall (x-Richtung). */
  u: Float32Array;
  /** Verschiebung in Pixel pro vollem Modellintervall (y-Richtung). */
  v: Float32Array;
  w: number;
  h: number;
  /** Grobe globale Verschiebung — Diagnose/Plausibilitätsprüfung. */
  globalU: number;
  globalV: number;
}

function downsample(src: Float32Array, w: number, h: number) {
  const dw = Math.max(1, w >> 1);
  const dh = Math.max(1, h >> 1);
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.min(h - 1, y * 2);
    const y1 = Math.min(h - 1, y * 2 + 1);
    for (let x = 0; x < dw; x++) {
      const x0 = Math.min(w - 1, x * 2);
      const x1 = Math.min(w - 1, x * 2 + 1);
      out[y * dw + x] =
        (src[y0 * w + x0] + src[y0 * w + x1] + src[y1 * w + x0] + src[y1 * w + x1]) * 0.25;
    }
  }
  return { data: out, w: dw, h: dh };
}

function upsampleFlow(src: Float32Array, w: number, h: number, dw: number, dh: number) {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(h - 1, (y * h) / dh);
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(w - 1, (x * w) / dw);
      const x0 = Math.floor(fx);
      const x1 = Math.min(w - 1, x0 + 1);
      const tx = fx - x0;
      const a = src[y0 * w + x0];
      const b = src[y0 * w + x1];
      const c = src[y1 * w + x0];
      const d = src[y1 * w + x1];
      out[y * dw + x] =
        (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  // Skalierung: Flussvektoren wachsen mit der Auflösung.
  const s = dw / w;
  for (let i = 0; i < out.length; i++) out[i] *= s;
  return out;
}

/** Grober globaler Verschiebungsvektor per Kreuzkorrelation (SSD-Minimum). */
function globalShift(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  radius: number,
): { u: number; v: number } {
  let bestU = 0;
  let bestV = 0;
  let bestCost = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      let cost = 0;
      let cnt = 0;
      for (let y = 0; y < h; y += 2) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let x = 0; x < w; x += 2) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const d = b[yy * w + xx] - a[y * w + x];
          cost += d * d;
          cnt++;
        }
      }
      if (cnt < 8) continue;
      const norm = cost / cnt + 0.0002 * (dx * dx + dy * dy);
      if (norm < bestCost) {
        bestCost = norm;
        bestU = dx;
        bestV = dy;
      }
    }
  }
  return { u: bestU, v: bestV };
}

function sampleBilinear(src: Float32Array, w: number, h: number, fx: number, fy: number) {
  const cx = Math.max(0, Math.min(w - 1, fx));
  const cy = Math.max(0, Math.min(h - 1, fy));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const a = src[y0 * w + x0];
  const b = src[y0 * w + x1];
  const c = src[y1 * w + x0];
  const d = src[y1 * w + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Horn–Schunck-Iterationen auf einer Pyramidenstufe (warping-basiert). */
function hornSchunck(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  u: Float32Array,
  v: Float32Array,
  iterations: number,
  alpha: number,
) {
  const uAvg = new Float32Array(w * h);
  const vAvg = new Float32Array(w * h);
  const idx = (x: number, y: number) =>
    Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x));

  for (let it = 0; it < iterations; it++) {
    // Nachbarschaftsmittel (4er-Nachbarschaft).
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        uAvg[i] =
          (u[idx(x - 1, y)] + u[idx(x + 1, y)] + u[idx(x, y - 1)] + u[idx(x, y + 1)]) * 0.25;
        vAvg[i] =
          (v[idx(x - 1, y)] + v[idx(x + 1, y)] + v[idx(x, y - 1)] + v[idx(x, y + 1)]) * 0.25;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // Gradienten aus dem gewarpten Zielbild — robust bei grossen Shifts.
        const wx = x + uAvg[i];
        const wy = y + vAvg[i];
        const bC = sampleBilinear(b, w, h, wx, wy);
        const bx =
          (sampleBilinear(b, w, h, wx + 1, wy) - sampleBilinear(b, w, h, wx - 1, wy)) * 0.5;
        const by =
          (sampleBilinear(b, w, h, wx, wy + 1) - sampleBilinear(b, w, h, wx, wy - 1)) * 0.5;
        const it0 = bC - a[i];
        const denom = alpha * alpha + bx * bx + by * by;
        const factor = denom > 0 ? it0 / denom : 0;
        u[i] = uAvg[i] - bx * factor;
        v[i] = vAvg[i] - by * factor;
      }
    }
  }
}

const flowCache = new Map<string, FlowField | null>();
const FLOW_CACHE_MAX = 64;

/**
 * Bewegungsfeld zwischen zwei mm/h-Rastern gleicher Grösse.
 * `key` sollte beide Frame-Zeitstempel enthalten (Cache-Schlüssel).
 */
export function computeFlow(
  key: string,
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
): FlowField | null {
  const cached = flowCache.get(key);
  if (cached !== undefined) {
    flowCache.delete(key);
    flowCache.set(key, cached);
    return cached;
  }

  const result = (() => {
    if (w < 8 || h < 8 || a.length !== w * h || b.length !== w * h) return null;

    // Signalprüfung: bei fast leeren Feldern lohnt keine Advektion.
    let sumA = 0;
    let sumB = 0;
    for (let i = 0; i < a.length; i++) {
      sumA += a[i];
      sumB += b[i];
    }
    if (sumA / a.length < 0.005 && sumB / b.length < 0.005) return null;

    // Pyramide aufbauen (3 Stufen, mind. 16 px Kantenlänge).
    const levels: { a: Float32Array; b: Float32Array; w: number; h: number }[] = [
      { a, b, w, h },
    ];
    for (let l = 0; l < 3; l++) {
      const prev = levels[0];
      if (prev.w < 32 || prev.h < 32) break;
      const da = downsample(prev.a, prev.w, prev.h);
      const db = downsample(prev.b, prev.w, prev.h);
      levels.unshift({ a: da.data, b: db.data, w: da.w, h: da.h });
    }

    const coarse = levels[0];
    const g = globalShift(coarse.a, coarse.b, coarse.w, coarse.h, 6);
    let u = new Float32Array(coarse.w * coarse.h).fill(g.u);
    let v = new Float32Array(coarse.w * coarse.h).fill(g.v);
    let cw = coarse.w;
    let ch = coarse.h;

    for (let li = 0; li < levels.length; li++) {
      const lv = levels[li];
      if (li > 0) {
        u = upsampleFlow(u, cw, ch, lv.w, lv.h);
        v = upsampleFlow(v, cw, ch, lv.w, lv.h);
        cw = lv.w;
        ch = lv.h;
      }
      const iterations = li === levels.length - 1 ? 12 : 24;
      hornSchunck(lv.a, lv.b, lv.w, lv.h, u, v, iterations, 4);
    }

    // Plausibilitätsgrenze: keine absurden Sprünge (max. 25 % der Bildbreite).
    const maxShift = Math.max(4, Math.min(w, h) * 0.25);
    let globalU = 0;
    let globalV = 0;
    for (let i = 0; i < u.length; i++) {
      if (u[i] > maxShift) u[i] = maxShift;
      else if (u[i] < -maxShift) u[i] = -maxShift;
      if (v[i] > maxShift) v[i] = maxShift;
      else if (v[i] < -maxShift) v[i] = -maxShift;
      globalU += u[i];
      globalV += v[i];
    }
    globalU /= u.length;
    globalV /= v.length;

    return { u, v, w, h, globalU, globalV } satisfies FlowField;
  })();

  flowCache.set(key, result);
  while (flowCache.size > FLOW_CACHE_MAX) {
    const first = flowCache.keys().next().value;
    if (first === undefined) break;
    flowCache.delete(first);
  }
  return result;
}

/**
 * Bidirektionale Advektion: Feld A wird um `p · flow` vorwärts, Feld B um
 * `(1 − p) · flow` rückwärts verschoben; anschliessend wird nur die Intensität
 * mit `p` gemischt. Die Geometrie stammt aus der Advektion.
 */
export function advectBlend(
  a: Float32Array,
  b: Float32Array,
  flow: FlowField,
  progress: number,
  w: number,
  h: number,
): Float32Array {
  const p = Math.max(0, Math.min(1, progress));
  const out = new Float32Array(w * h);
  const { u, v } = flow;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const du = u[i];
      const dv = v[i];
      const av = sampleBilinear(a, w, h, x - du * p, y - dv * p);
      const bv = sampleBilinear(b, w, h, x + du * (1 - p), y + dv * (1 - p));
      out[i] = av * (1 - p) + bv * p;
    }
  }
  return out;
}
