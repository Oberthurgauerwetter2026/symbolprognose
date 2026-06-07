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
 *   - ICON-CH1 stündlich (bis +24 h) — ein Frame pro voller Stunde,
 *     direkt aus dem nativen Modell-Output. Keine Advektion, keine
 *     15-min-Interpolation, keine Wind-Glättung — ehrliche Stundenanzeige
 *     mit weichem Crossfade im Client.
 *
 * Kein Nowcast, keine Zell-Extrapolation.
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
    snowfall?: (number | null)[];
    wind_speed_700hPa?: (number | null)[];
    wind_direction_700hPa?: (number | null)[];
  };
};


// (Entfernt: advectField / estimateGlobalShift / blendClosestCell —
//  Prognose ist jetzt stündlich ohne künstliche Bewegung.)


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
  setResponseHeader(
    "Cache-Control",
    "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
  );


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
  const forecastCutoff = now + 48 * 3600 * 1000;
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
    const nPts = pts.length;

    // ---- Stündliche Prognose-Frames direkt aus ICON-CH1 ----
    // ICON-CH1 ist nativ stündlich. Wir lesen das :00-Sample aus minutely_15
    // (entspricht dem Stundenwert) und emittieren je volle Stunde genau einen
    // Frame. Keine Advektion, kein 15-min-Resampling — der Crossfade im Client
    // sorgt für den weichen optischen Übergang zwischen den Stundenframes.
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti];
      if (!tIso.endsWith(":00")) continue;
      const tMs = Date.parse(tIso + "Z");
      if (tMs <= now) continue;
      if (tMs > forecastCutoff) continue;

      const dtMinFromNow = Math.max(0, (tMs - now) / 60_000);
      const biasWeight =
        biasFactor === 1 ? 0 : Math.max(0, 1 - dtMinFromNow / BIAS_FADE_MIN);
      const correction = 1 + (biasFactor - 1) * biasWeight;

      const precip = new Array<number>(nPts).fill(0);
      const snow: number[] | undefined = hasSnow ? new Array<number>(nPts).fill(0) : undefined;
      for (let pi = 0; pi < nPts; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const p = loc?.minutely_15?.precipitation?.[ti];
        // minutely_15 precip ist mm/15min; ×4 = mm/h.
        const mmh = typeof p === "number" ? p * 4 : 0;
        precip[pi] = correction === 1 ? mmh : mmh * correction;
        if (snow) {
          const s = loc?.minutely_15?.snowfall?.[ti];
          const smm = typeof s === "number" ? s * 4 : 0;
          snow[pi] = correction === 1 ? smm : smm * correction;
        }
      }

      frames.push({
        t: tIso + "Z",
        source: "icon-ch1",
        values: precip,
        snowValues: snow,
      });
    }
  }


  // ---- Prognose-Verlängerung: ICON-CH2 (hourly, > CH1-Horizont … +48 h) ----
  // Open-Meteo liefert in phase1.hourly.precipitation die ICON-CH2-Verlängerung
  // (meteoswiss-Modellkette) bis +120 h. Wir emittieren je Stunde einen Frame
  // für alles oberhalb des letzten CH1-Frames, gedeckelt durch forecastCutoff.
  const lastCh1Ms = frames
    .filter((f) => f.source === "icon-ch1")
    .reduce((m, f) => Math.max(m, Date.parse(f.t)), 0);
  const ref1Hourly = r1 ? (r1[0] as LocResponse | undefined)?.hourly : undefined;
  let ch2Count = 0;
  if (ref1Hourly && r1 && Array.isArray(ref1Hourly.precipitation)) {
    const hasHourlySnow = Array.isArray(ref1Hourly.snowfall);
    const nPts = pts.length;
    for (let ti = 0; ti < ref1Hourly.time.length; ti++) {
      const tIso = ref1Hourly.time[ti];
      const tMs = Date.parse(tIso + "Z");
      if (!Number.isFinite(tMs)) continue;
      if (tMs <= now) continue;
      if (tMs <= lastCh1Ms) continue;
      if (tMs > forecastCutoff) continue;

      const dtMinFromNow = Math.max(0, (tMs - now) / 60_000);
      const biasWeight =
        biasFactor === 1 ? 0 : Math.max(0, 1 - dtMinFromNow / BIAS_FADE_MIN);
      const correction = 1 + (biasFactor - 1) * biasWeight;

      const precip = new Array<number>(nPts).fill(0);
      const snow: number[] | undefined = hasHourlySnow ? new Array<number>(nPts).fill(0) : undefined;
      for (let pi = 0; pi < nPts; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const p = loc?.hourly?.precipitation?.[ti];
        // hourly.precipitation ist bereits mm/h — kein ×4 nötig.
        const mmh = typeof p === "number" ? p : 0;
        precip[pi] = correction === 1 ? mmh : mmh * correction;
        if (snow) {
          const s = loc?.hourly?.snowfall?.[ti];
          const smm = typeof s === "number" ? s : 0;
          snow[pi] = correction === 1 ? smm : smm * correction;
        }
      }

      frames.push({
        t: tIso + "Z",
        source: "icon-ch2",
        values: precip,
        snowValues: snow,
      });
      ch2Count++;
    }
  }

  const ch1Count = frames.filter((f) => f.source === "icon-ch1").length;
  console.info(`[radar] forecast: ch1=${ch1Count} ch2=${ch2Count}`);


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
