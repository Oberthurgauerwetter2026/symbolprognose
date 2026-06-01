import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache, type OpenMeteoCachePayload } from "./openmeteo-cache.server";

/**
 * Radar-Frames für die Region Oberthurgau.
 *
 * Vergangenheit (≤ now):
 *   - MeteoSchweiz-CombiPrecip-/POH-PNGs aus Cloudflare R2
 *     (befüllt durch `scripts/ingest_radar.py` via GitHub Actions).
 *   - Zusätzlich Grid-Werte aus ICON-CH1 `past_minutely_15` zur konsistenten
 *     Darstellung ausserhalb des CombiPrecip-Ausschnitts (gleiche Farbskala).
 *
 * Vorhersage (> now):
 *   - ICON-CH1 minutely_15 (bis +24 h)
 *
 * Kein Nowcast, keine Zell-Extrapolation, keine Wind-Advection-Glättung.
 * Übergang Messung → Prognose ist hart bei `now`.
 */

const BBOX = { minLat: 46.85, maxLat: 48.30, minLon: 8.15, maxLon: 10.55 } as const;
const GRID_LON = 36;
const GRID_LAT = 22;

function buildGrid() {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < GRID_LAT; i++) {
    lats.push(BBOX.minLat + ((BBOX.maxLat - BBOX.minLat) * i) / (GRID_LAT - 1));
  }
  for (let j = 0; j < GRID_LON; j++) {
    lons.push(BBOX.minLon + ((BBOX.maxLon - BBOX.minLon) * j) / (GRID_LON - 1));
  }
  const pts: { lat: number; lon: number }[] = [];
  for (const la of lats) for (const lo of lons) pts.push({ lat: la, lon: lo });
  return { lats, lons, pts };
}

function gridFromCachePoints(
  points: { lat: number; lon: number }[] | undefined,
): { lats: number[]; lons: number[]; pts: { lat: number; lon: number }[] } | null {
  if (!points || points.length === 0) return null;
  const latSet = new Set<number>();
  const lonSet = new Set<number>();
  for (const p of points) {
    latSet.add(p.lat);
    lonSet.add(p.lon);
  }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  if (lats.length * lons.length !== points.length) return null;
  if (lats.length !== GRID_LAT || lons.length !== GRID_LON) return null;
  const coversTarget =
    lats[0] <= BBOX.minLat + 0.001 &&
    lats[lats.length - 1] >= BBOX.maxLat - 0.001 &&
    lons[0] <= BBOX.minLon + 0.001 &&
    lons[lons.length - 1] >= BBOX.maxLon - 0.001;
  if (!coversTarget) return null;
  const pts: { lat: number; lon: number }[] = [];
  for (const la of lats) for (const lo of lons) pts.push({ lat: la, lon: lo });
  return { lats, lons, pts };
}

function cacheGridLooksStale(points: { lat: number; lon: number }[] | undefined): boolean {
  if (!points || points.length === 0) return false;
  return gridFromCachePoints(points) === null;
}

export interface RadarFrame {
  t: string; // ISO UTC — Zeitpunkt, der auf der Timeline angezeigt wird
  source: "radar" | "icon-ch1" | "icon-ch2";
  /** Tatsächlicher Zeitstempel des PNG-Bildes (identisch mit `t`, kein Forward-Fill). */
  sourceT?: string;
  /** Niederschlag mm/h pro Grid-Punkt (row-major). Bei reinen `precipUrl`-Frames leer. */
  values: number[];
  /** Schnee-Wasser-Äquivalent mm/h pro Grid-Punkt (row-major). Leer = unbekannt. */
  snowValues?: number[];
  /** Wenn gesetzt, als ImageOverlay rendern statt Canvas (echte MCH-Daten). */
  precipUrl?: string;
  /** Optionaler Hagel-Overlay (POH %) URL. */
  hailUrl?: string;
  /** Optional: Bbox des PNG-Overlays für diesen Frame. */
  imageBbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

export interface RadarPayload {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  imageBbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  gridLat: number[];
  gridLon: number[];
  frames: RadarFrame[];
  generatedAt: string;
  hasRealRadar: boolean;
  hasHail: boolean;
  warning?: string;
}

type OpenMeteoCache = OpenMeteoCachePayload;

async function fetchOpenMeteoCache(): Promise<OpenMeteoCache | null> {
  return getOpenMeteoCache();
}

type LocResponse = {
  minutely_15?: {
    time: string[];
    precipitation: (number | null)[];
    snowfall?: (number | null)[];
  };
  hourly?: {
    time: string[];
    precipitation?: (number | null)[];
    wind_speed_700hPa?: (number | null)[];
    wind_direction_700hPa?: (number | null)[];
  };
};

// Semi-Lagrangian Backward-Advection eines 2D-Felds entlang u/v (m/s).
// Layout: row-major i*nLon + j. dtSeconds > 0 → Vorwärts-Verlagerung
// (Quelle = Ziel − v·dt), dtSeconds < 0 → Rückwärts.
function advectField(
  field: number[],
  u: number[],
  v: number[],
  dtSeconds: number,
  lats: number[],
  lons: number[],
): number[] {
  const nLat = lats.length;
  const nLon = lons.length;
  const out = new Array<number>(nLat * nLon).fill(0);
  if (Math.abs(dtSeconds) < 1) {
    for (let k = 0; k < field.length; k++) out[k] = field[k] ?? 0;
    return out;
  }
  const lat0 = lats[0];
  const dLat = lats[nLat - 1] - lats[0];
  const lon0 = lons[0];
  const dLon = lons[nLon - 1] - lons[0];
  const M_PER_DEG_LAT = 111_320;

  for (let i = 0; i < nLat; i++) {
    const lat = lats[i];
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      const uu = u[k] ?? 0;
      const vv = v[k] ?? 0;
      const srcLat = lat - (vv * dtSeconds) / M_PER_DEG_LAT;
      const srcLon = lons[j] - (uu * dtSeconds) / mPerDegLon;
      const fy = ((srcLat - lat0) / dLat) * (nLat - 1);
      const fx = ((srcLon - lon0) / dLon) * (nLon - 1);
      if (fy < 0 || fy > nLat - 1 || fx < 0 || fx > nLon - 1) continue;
      const y0 = Math.floor(fy);
      const x0 = Math.floor(fx);
      const y1 = Math.min(y0 + 1, nLat - 1);
      const x1 = Math.min(x0 + 1, nLon - 1);
      const ty = fy - y0;
      const tx = fx - x0;
      const v00 = field[y0 * nLon + x0] ?? 0;
      const v01 = field[y0 * nLon + x1] ?? 0;
      const v10 = field[y1 * nLon + x0] ?? 0;
      const v11 = field[y1 * nLon + x1] ?? 0;
      out[k] =
        v00 * (1 - tx) * (1 - ty) +
        v01 * tx * (1 - ty) +
        v10 * (1 - tx) * ty +
        v11 * tx * ty;
    }
  }
  return out;
}

type ManifestFrame = { t: string; precipUrl?: string; hailUrl?: string };
type Manifest = {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  generatedAt: string;
  frames: ManifestFrame[];
};

async function fetchR2Manifest(): Promise<Manifest | null> {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    console.warn("[radar] R2_PUBLIC_URL not set — falling back to Open-Meteo only");
    return null;
  }
  const trimmed = base.replace(/\/+$/, "");
  const url = /\/radar\/frames\.json$/i.test(trimmed)
    ? trimmed
    : `${trimmed.replace(/\/radar\/?$/i, "")}/radar/frames.json`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30 } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[radar] manifest fetch ${url} -> ${res.status}`);
      return null;
    }
    const json = (await res.json()) as Manifest;
    console.log(`[radar] manifest loaded: ${json.frames?.length ?? 0} frames`);
    return json;
  } catch (e) {
    console.warn(`[radar] manifest fetch error: ${(e as Error).message}`);
    return null;
  }
}

export const getRadarFrames = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "public, max-age=60, s-maxage=120");

  const [cacheRes, manifestRes] = await Promise.allSettled([
    fetchOpenMeteoCache(),
    fetchR2Manifest(),
  ]);

  const cache = cacheRes.status === "fulfilled" ? cacheRes.value : null;
  const manifest = manifestRes.status === "fulfilled" ? manifestRes.value : null;

  const cacheGrid = gridFromCachePoints(cache?.grid?.points);
  const cacheGridStale = cacheGridLooksStale(cache?.grid?.points);
  const { lats, lons, pts } = cacheGrid ?? buildGrid();
  const r1Candidate = cache ? (cache.phase1 ?? cache.phaseB ?? null) : null;
  const r1 =
    !cacheGridStale && Array.isArray(r1Candidate) && r1Candidate.length === pts.length
      ? r1Candidate
      : null;

  const warnings: string[] = [];
  if (!cache) {
    warnings.push("Open-Meteo-Cache temporär nicht verfügbar");
  } else if (cacheGridStale) {
    warnings.push("Open-Meteo-Cache nutzt noch die alte kleine Radar-Abdeckung; Prognose wird nach dem nächsten Ingest erweitert");
  } else if (Array.isArray(r1Candidate) && r1Candidate.length !== pts.length) {
    warnings.push("Open-Meteo-Cache enthält noch alte Prognosepunkte; Prognose wird nach dem nächsten Ingest erweitert");
  }

  const now = Date.now();
  const forecastCutoff = now + 24 * 3600 * 1000;
  const pastCutoff = now - 6 * 3600 * 1000;
  const frames: RadarFrame[] = [];

  // ---- Messung: MeteoSchweiz-Radar-PNGs (Vergangenheit) ----
  const hasRealRadar = !!manifest && manifest.frames.length > 0;
  const hasHail = hasRealRadar && manifest!.frames.some((f) => f.hailUrl);
  const imageBbox = manifest?.bbox ?? BBOX;

  if (hasRealRadar) {
    const sortedMf = [...manifest!.frames].sort(
      (a, b) => Date.parse(a.t) - Date.parse(b.t),
    );

    // ICON-CH1 past_minutely_15 → Time-Index für Canvas-Füllung ausserhalb MCH-Ausschnitt.
    const ref1Past = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;
    const hasPastSnow = Array.isArray(
      (r1?.[0] as LocResponse | undefined)?.minutely_15?.snowfall,
    );
    const pastTimeIdx = new Map<number, number>();
    if (ref1Past?.time) {
      for (let ti = 0; ti < ref1Past.time.length; ti++) {
        pastTimeIdx.set(Date.parse(ref1Past.time[ti] + "Z"), ti);
      }
    }
    const findPastIdx = (tMs: number): number => {
      const exact = pastTimeIdx.get(tMs);
      if (typeof exact === "number") return exact;
      let best = -1;
      let bestDt = 10 * 60_000 + 1;
      for (const [tm, idx] of pastTimeIdx) {
        const dt = Math.abs(tm - tMs);
        if (dt < bestDt) {
          bestDt = dt;
          best = idx;
        }
      }
      return best;
    };

    for (const mf of sortedMf) {
      // Nur Frames mit echtem PNG — kein Forward-Fill, damit angezeigte Uhrzeit
      // immer dem real gezeigten Bild entspricht.
      if (!mf.precipUrl) continue;
      const tMs = Date.parse(mf.t);
      if (tMs > now) continue;
      if (tMs < pastCutoff) continue;

      let values: number[] = [];
      let snowValues: number[] | undefined;
      if (r1 && pastTimeIdx.size > 0) {
        const ti = findPastIdx(tMs);
        if (ti >= 0) {
          values = new Array(pts.length);
          if (hasPastSnow) snowValues = new Array(pts.length);
          for (let pi = 0; pi < pts.length; pi++) {
            const loc = r1[pi] as LocResponse | undefined;
            const v = loc?.minutely_15?.precipitation?.[ti];
            values[pi] = typeof v === "number" ? v * 4 : 0;
            if (snowValues) {
              const s = loc?.minutely_15?.snowfall?.[ti];
              snowValues[pi] = typeof s === "number" ? s * 4 : 0;
            }
          }
        }
      }

      frames.push({
        t: mf.t,
        source: "radar",
        sourceT: mf.t,
        values,
        snowValues,
        precipUrl: mf.precipUrl,
        hailUrl: mf.hailUrl,
      });
    }
  }

  // ---- Prognose: ICON-CH1 (minutely_15, bis +24 h) ----
  const ref1 = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;

  // Bias-Korrektur Messung↔Prognose: Mittel der letzten 3 Messungen vs. ICON-CH1
  // im Fenster [now, now+30min]. Fade über 120 min linear gegen 1.
  let biasFactor = 1;
  const BIAS_FADE_MIN = 120;
  if (ref1 && r1 && hasRealRadar) {
    // Radar-Mittel aus letzten 3 Frames (>0.05 mm/h Pixel).
    const radarFrames = frames.filter((f) => f.source === "radar" && f.values.length > 0);
    const recent = radarFrames.slice(-3);
    let rSum = 0;
    let rN = 0;
    for (const rf of recent) {
      for (const v of rf.values) {
        if (v > 0.05) {
          rSum += v;
          rN++;
        }
      }
    }
    const radarMean = rN > 0 ? rSum / rN : 0;

    if (radarMean > 0.05) {
      let iconSum = 0;
      let iconN = 0;
      for (let ti = 0; ti < ref1.time.length; ti++) {
        const tMs = Date.parse(ref1.time[ti] + "Z");
        if (tMs < now - 5 * 60_000 || tMs > now + 30 * 60_000) continue;
        for (let pi = 0; pi < pts.length; pi++) {
          const v = (r1[pi] as LocResponse | undefined)?.minutely_15?.precipitation?.[ti];
          if (typeof v === "number" && v > 0.025) {
            iconSum += v * 4;
            iconN += 1;
          }
        }
      }
      const iconMean = iconN > 0 ? iconSum / iconN : 0;
      if (iconMean > 0.05) {
        const raw = radarMean / iconMean;
        biasFactor = Math.max(0.4, Math.min(2.5, raw));
        console.info(
          `[radar] bias-correction: radar=${radarMean.toFixed(2)} ` +
            `icon=${iconMean.toFixed(2)} -> factor ${biasFactor.toFixed(2)} ` +
            `(fade ${BIAS_FADE_MIN}min)`,
        );
      }
    }
  }

  if (ref1 && r1) {
    const hasSnow = Array.isArray((r1[0] as LocResponse | undefined)?.minutely_15?.snowfall);
    const nLat = lats.length;
    const nLon = lons.length;
    const nPts = nLat * nLon;

    // ---- Stündliche Anker-Felder (precip mm/h, snow mm/h, u/v m/s @700 hPa) ----
    // ICON-CH1 ist nativ stündlich. Wir nehmen je Stunde das erste 15-min-Sample
    // aus minutely_15 (= Stundenwert) und den Wind aus hourly. Zwischen den
    // Stundenankern wird per Semi-Lagrangian-Advection entlang des 700-hPa-Winds
    // verlagert + linear geblendet → Zellen wandern sichtbar.
    type Anchor = {
      tMs: number;
      precip: number[];
      snow: number[] | null;
      u: number[];
      v: number[];
    };
    const anchors: Anchor[] = [];
    const ref1Hourly = (r1[0] as LocResponse | undefined)?.hourly;
    const hourTimes = ref1Hourly?.time ?? [];
    // Map: ISO-Stunde → Index in hourly.time
    const hourIdxByIso = new Map<string, number>();
    for (let h = 0; h < hourTimes.length; h++) hourIdxByIso.set(hourTimes[h], h);

    const M_PER_S_FROM_KMH = 1 / 3.6;
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti];
      // Nur volle Stunden als Anker (minutely_15 endet auf :00).
      if (!tIso.endsWith(":00")) continue;
      const tMs = Date.parse(tIso + "Z");
      const hIdx = hourIdxByIso.get(tIso);
      const precip = new Array<number>(nPts).fill(0);
      const snow = hasSnow ? new Array<number>(nPts).fill(0) : null;
      const u = new Array<number>(nPts).fill(0);
      const v = new Array<number>(nPts).fill(0);
      for (let pi = 0; pi < nPts; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const p = loc?.minutely_15?.precipitation?.[ti];
        // minutely_15 precip ist mm/15min (Stunde wiederholt 4×) → ×4 = mm/h
        precip[pi] = typeof p === "number" ? p * 4 : 0;
        if (snow) {
          const s = loc?.minutely_15?.snowfall?.[ti];
          snow[pi] = typeof s === "number" ? s * 4 : 0;
        }
        if (hIdx !== undefined) {
          const spdKmh = loc?.hourly?.wind_speed_700hPa?.[hIdx];
          const dirDeg = loc?.hourly?.wind_direction_700hPa?.[hIdx];
          if (typeof spdKmh === "number" && typeof dirDeg === "number") {
            const spd = spdKmh * M_PER_S_FROM_KMH;
            const rad = (dirDeg * Math.PI) / 180;
            // Open-Meteo wind_direction = Herkunftsrichtung
            u[pi] = -spd * Math.sin(rad);
            v[pi] = -spd * Math.cos(rad);
          }
        }
      }
      anchors.push({ tMs, precip, snow, u, v });
    }

    // ---- Zwischen-Frames per Advection erzeugen ----
    // Alle minutely_15 Zeitpunkte durchgehen, passenden Anker-Slot finden,
    // A vorwärts + B rückwärts advektieren und blenden.
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= now) continue;
      if (tMs > forecastCutoff) continue;

      // Anker-Slot: letzter Anker mit tMs <= aktueller Zeit
      let a = -1;
      for (let k = 0; k < anchors.length; k++) {
        if (anchors[k].tMs <= tMs) a = k;
        else break;
      }
      if (a < 0) continue;

      const A = anchors[a];
      const B = anchors[a + 1];
      const dtMinFromNow = Math.max(0, (tMs - now) / 60_000);
      const biasWeight =
        biasFactor === 1 ? 0 : Math.max(0, 1 - dtMinFromNow / BIAS_FADE_MIN);
      const correction = 1 + (biasFactor - 1) * biasWeight;

      let precipOut: number[];
      let snowOut: number[] | undefined;
      if (!B) {
        // Letzter Anker: kein Nachbar → Identität.
        precipOut = A.precip.slice();
        if (A.snow) snowOut = A.snow.slice();
      } else {
        const span = B.tMs - A.tMs; // ms
        const dtToA = tMs - A.tMs;
        const dtToB = tMs - B.tMs; // negativ
        const alpha = Math.max(0, Math.min(1, dtToA / span));
        const aFwd = advectField(A.precip, A.u, A.v, dtToA / 1000, lats, lons);
        const bBwd = advectField(B.precip, B.u, B.v, dtToB / 1000, lats, lons);
        precipOut = new Array<number>(nPts);
        for (let k = 0; k < nPts; k++) {
          precipOut[k] = Math.max(0, (1 - alpha) * aFwd[k] + alpha * bBwd[k]);
        }
        if (A.snow && B.snow) {
          const aFwdS = advectField(A.snow, A.u, A.v, dtToA / 1000, lats, lons);
          const bBwdS = advectField(B.snow, B.u, B.v, dtToB / 1000, lats, lons);
          snowOut = new Array<number>(nPts);
          for (let k = 0; k < nPts; k++) {
            snowOut[k] = Math.max(0, (1 - alpha) * aFwdS[k] + alpha * bBwdS[k]);
          }
        }
      }

      if (correction !== 1) {
        for (let k = 0; k < nPts; k++) precipOut[k] *= correction;
        if (snowOut) for (let k = 0; k < nPts; k++) snowOut[k] *= correction;
      }

      frames.push({ t: tIso, source: "icon-ch1", values: precipOut, snowValues: snowOut });
    }
  }

  // ICON-CH2 (hourly, +33…+48 h) wurde mit Cutoff-Reduktion auf +24 h entfernt.

  const ch1Count = frames.filter((f) => f.source === "icon-ch1").length;
  console.info(`[radar] forecast: ch1=${ch1Count}`);

  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  if (frames.length === 0) {
    throw new Error(
      warnings.length > 0
        ? `Radardaten nicht verfügbar: ${warnings.join("; ")}`
        : "Radardaten nicht verfügbar",
    );
  }

  const payload: RadarPayload = {
    bbox: BBOX,
    imageBbox,
    gridLat: lats,
    gridLon: lons,
    frames,
    generatedAt: new Date().toISOString(),
    hasRealRadar,
    hasHail,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined,
  };
  return payload;
});
