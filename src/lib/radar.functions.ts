import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache, type OpenMeteoCachePayload } from "./openmeteo-cache.server";
import { r2ObjectUrlCandidates } from "./r2-url.server";

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
 *   - Durchgehend 15-Minuten-Frames bis +48 h.
 *   - Direkte ICON-CH1-`minutely_15`-Slots werden bevorzugt; fehlende
 *     Viertelstundenwerte werden aus benachbarten Modellstunden interpoliert.
 *
 * Keine Wind-Advektion, kein Nowcast, keine künstliche Zell-Extrapolation.
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
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_speed_700hPa?: (number | null)[];
    wind_direction_700hPa?: (number | null)[];
  };
};



// (Entfernt: advectField / estimateGlobalShift / blendClosestCell —
//  Prognose läuft im Viertelstundenraster ohne künstliche Bewegung.)


type ManifestFrame = { t: string; precipUrl?: string; hailUrl?: string };
type Manifest = {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  generatedAt: string;
  frames: ManifestFrame[];
};

type ForecastManifestFrame = {
  t: string;
  precipUrl: string;
  source?: "icon-ch1" | "icon-ch2";
  hasPrecip?: boolean;
};
type ForecastManifest = {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  generatedAt: string;
  frames: ForecastManifestFrame[];
};

function validManifestFrame(frame: ManifestFrame): frame is ManifestFrame & { t: string } {
  return typeof frame?.t === "string" && !Number.isNaN(Date.parse(frame.t));
}

async function fetchR2Manifest(): Promise<Manifest | null> {
  const candidates = [
    ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, "radar/frames.json"),
    ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, "radar/frames.json"),
    ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, "radar/frames.json"),
  ].filter((url, index, all) => all.indexOf(url) === index);

  if (candidates.length === 0) {
    console.warn("[radar] no R2 radar manifest URL configured — falling back to model data only");
    return null;
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        cf: { cacheTtl: 30 } as unknown as undefined,
      } as RequestInit);
      if (!res.ok) {
        console.warn(`[radar] manifest fetch ${url} -> ${res.status}`);
        continue;
      }
      const json = (await res.json()) as Manifest;
      if (!json?.bbox || !Array.isArray(json.frames)) {
        console.warn(`[radar] manifest ${url} has invalid shape`);
        continue;
      }
      json.frames = json.frames.filter(validManifestFrame);
      console.log(
        `[radar] manifest loaded from ${url}: ${json.frames.length} frames, ` +
          `${json.frames.filter((f) => !!f.precipUrl).length} precip`,
      );
      return json;
    } catch (e) {
      console.warn(`[radar] manifest fetch error ${url}: ${(e as Error).message}`);
    }
  }

  return null;
}

async function fetchR2ForecastManifest(): Promise<ForecastManifest | null> {
  const candidates = [
    ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, "radar/forecast-frames.json"),
    ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, "radar/forecast-frames.json"),
    ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, "radar/forecast-frames.json"),
  ].filter((url, index, all) => all.indexOf(url) === index);

  if (candidates.length === 0) return null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        cf: { cacheTtl: 30 } as unknown as undefined,
      } as RequestInit);
      if (!res.ok) {
        console.warn(`[radar] forecast manifest fetch ${url} -> ${res.status}`);
        continue;
      }
      const json = (await res.json()) as ForecastManifest;
      if (!json?.bbox || !Array.isArray(json.frames)) {
        console.warn(`[radar] forecast manifest ${url} has invalid shape`);
        continue;
      }
      json.frames = json.frames.filter(
        (f) =>
          typeof f?.t === "string" &&
          typeof f?.precipUrl === "string" &&
          !Number.isNaN(Date.parse(f.t)),
      );
      console.log(`[radar] forecast manifest loaded from ${url}: ${json.frames.length} frames`);
      return json;
    } catch (e) {
      console.warn(`[radar] forecast manifest fetch error ${url}: ${(e as Error).message}`);
    }
  }

  return null;
}

export const getRadarFrames = createServerFn({ method: "GET" })
  .inputValidator((data?: { extended?: boolean }) => ({
    extended: data?.extended === true,
  }))
  .handler(async ({ data: input }) => {
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
  const r2Candidate = cache ? cache.phase2 ?? null : null;
  const r2 =
    !cacheGridStale && Array.isArray(r2Candidate) && r2Candidate.length === pts.length
      ? r2Candidate
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
  // Modellprognose immer bis +48 h. `extended` bleibt aus Back-Compat
  // erhalten, hat aber keine Auswirkung mehr auf den Horizont.
  void input.extended;
  const forecastHorizonH = 48;
  const forecastCutoff = now + forecastHorizonH * 3600 * 1000;
  const pastCutoff = now - 6 * 3600 * 1000;
  const frames: RadarFrame[] = [];

  // ---- Messung: MeteoSchweiz-Radar-PNGs (Vergangenheit) ----
  const hasRealRadar = !!manifest && manifest.frames.some((frame) => !!frame.precipUrl);
  // Hagel-Layer verfügbar, sobald Mess-Frames existieren: zeigt entweder
  // echte POH-Daten (sofern in einem Frame vorhanden) oder aus der
  // Niederschlagsintensität abgeleitete Hagel-Punkte bei Gewitter.
  const hasHail = hasRealRadar;

  const imageBbox = manifest?.bbox ?? BBOX;

  if (!hasRealRadar) {
    warnings.push("MCH-Radarmessungen temporär nicht verfügbar");
  }

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

  // ---- Prognose: ICON-CH1 (minutely_15) + Stundenmodell-Fallback ----
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

  // ---- Prognose-Frames (+15 min … +48 h) ----
  // Durchgehend im Viertelstunden-Raster: :00, :15, :30, :45.
  // Reihenfolge der Quellen:
  //  1) Direkter ICON-CH1 minutely_15-Slot (`r1`), sofern vorhanden
  //  2) Interpolierter Wert zwischen den benachbarten Modellstunden
  //     (CH1 hourly oder ICON-seamless hourly/phase2)
  // Es werden keine Frames kopiert und keine künstlichen Bewegungen erzeugt.
  const nPts = pts.length;
  const r1Min = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;
  const r1Hour = r1 ? (r1[0] as LocResponse | undefined)?.hourly : undefined;
  const r2Hour = r2 ? (r2[0] as LocResponse | undefined)?.hourly : undefined;

  const hasMinSnow = Array.isArray(r1Min?.snowfall);
  const hasR1HourSnow = Array.isArray(r1Hour?.snowfall);
  const hasR2HourSnow = Array.isArray(r2Hour?.snowfall);
  const emitSnow = hasMinSnow || hasR1HourSnow || hasR2HourSnow;

  // Map ALLE 15-min-Slots aus minutely_15 (für 15-min-Phase)
  const min15Idx = new Map<number, number>();
  if (r1Min?.time) {
    for (let ti = 0; ti < r1Min.time.length; ti++) {
      const tIso = r1Min.time[ti];
      const ms = Date.parse(tIso + "Z");
      min15Idx.set(ms, ti);
    }
  }
  const r1HourIdx = new Map<number, number>();
  if (r1Hour?.time) {
    for (let ti = 0; ti < r1Hour.time.length; ti++) {
      r1HourIdx.set(Date.parse(r1Hour.time[ti] + "Z"), ti);
    }
  }
  const r2HourIdx = new Map<number, number>();
  if (r2Hour?.time) {
    for (let ti = 0; ti < r2Hour.time.length; ti++) {
      r2HourIdx.set(Date.parse(r2Hour.time[ti] + "Z"), ti);
    }
  }

  const applyBias = (
    tMs: number,
    precip: number[],
    snow: number[] | undefined,
  ) => {
    if (biasFactor === 1) return;
    const dtMinFromNow = Math.max(0, (tMs - now) / 60_000);
    const biasWeight = Math.max(0, 1 - dtMinFromNow / BIAS_FADE_MIN);
    const correction = 1 + (biasFactor - 1) * biasWeight;
    if (correction === 1) return;
    for (let pi = 0; pi < nPts; pi++) precip[pi] *= correction;
    if (snow) for (let pi = 0; pi < nPts; pi++) snow[pi] *= correction;
  };

  type ForecastGrid = { precip: number[]; snow?: number[]; source: "icon-ch1" | "icon-ch2" };

  const readForecastExact = (tMs: number): ForecastGrid | null => {
    let precip: number[] | null = null;
    let snow: number[] | undefined;
    let source: "icon-ch1" | "icon-ch2" = "icon-ch1";

    const tiMin = min15Idx.get(tMs);
    if (typeof tiMin === "number" && r1) {
      const p = new Array<number>(nPts).fill(0);
      const s = hasMinSnow ? new Array<number>(nPts).fill(0) : undefined;
      let any = false;
      for (let pi = 0; pi < nPts; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const v = loc?.minutely_15?.precipitation?.[tiMin];
        if (typeof v === "number") {
          p[pi] = v * 4;
          any = true;
        }
        if (s) {
          const sv = loc?.minutely_15?.snowfall?.[tiMin];
          if (typeof sv === "number") {
            s[pi] = sv * 4;
            any = true;
          }
        }
      }
      if (any) {
        precip = p;
        snow = s;
      }
    }

    if (!precip) {
      const tiH1 = r1HourIdx.get(tMs);
      if (typeof tiH1 === "number" && r1) {
        const p = new Array<number>(nPts).fill(0);
        const s = hasR1HourSnow ? new Array<number>(nPts).fill(0) : undefined;
        let any = false;
        for (let pi = 0; pi < nPts; pi++) {
          const loc = r1[pi] as LocResponse | undefined;
          const v = loc?.hourly?.precipitation?.[tiH1];
          if (typeof v === "number") {
            p[pi] = v;
            any = true;
          }
          if (s) {
            const sv = loc?.hourly?.snowfall?.[tiH1];
            if (typeof sv === "number") {
              s[pi] = sv;
              any = true;
            }
          }
        }
        if (any) {
          precip = p;
          snow = s;
        }
      }
    }

    if (!precip) {
      const tiH2 = r2HourIdx.get(tMs);
      if (typeof tiH2 === "number" && r2) {
        const p = new Array<number>(nPts).fill(0);
        const s = hasR2HourSnow ? new Array<number>(nPts).fill(0) : undefined;
        let any = false;
        for (let pi = 0; pi < nPts; pi++) {
          const loc = r2[pi] as LocResponse | undefined;
          const v = loc?.hourly?.precipitation?.[tiH2];
          if (typeof v === "number") {
            p[pi] = v;
            any = true;
          }
          if (s) {
            const sv = loc?.hourly?.snowfall?.[tiH2];
            if (typeof sv === "number") {
              s[pi] = sv;
              any = true;
            }
          }
        }
        if (any) {
          precip = p;
          snow = s;
          source = "icon-ch2";
        }
      }
    }

    if (!precip) return null;
    if (source === "icon-ch1") applyBias(tMs, precip, snow);
    return { precip, snow, source };
  };

  const exactCache = new Map<number, ForecastGrid | null>();
  const getForecastExact = (tMs: number) => {
    if (!exactCache.has(tMs)) exactCache.set(tMs, readForecastExact(tMs));
    return exactCache.get(tMs) ?? null;
  };

  const interpolateForecast = (tMs: number): ForecastGrid | null => {
    const aMs = Math.floor(tMs / 3600_000) * 3600_000;
    const bMs = aMs + 3600_000;
    const a = getForecastExact(aMs);
    const b = getForecastExact(bMs);
    if (!a || !b) return null;
    const w = (tMs - aMs) / 3600_000;
    const precip = new Array<number>(nPts);
    const snow = emitSnow ? new Array<number>(nPts) : undefined;
    for (let pi = 0; pi < nPts; pi++) {
      precip[pi] = a.precip[pi] + (b.precip[pi] - a.precip[pi]) * w;
      if (snow) {
        const av = a.snow?.[pi] ?? 0;
        const bv = b.snow?.[pi] ?? 0;
        snow[pi] = av + (bv - av) * w;
      }
    }
    return { precip, snow, source: a.source === "icon-ch2" && b.source === "icon-ch2" ? "icon-ch2" : "icon-ch1" };
  };

  let ch1QuarterCount = 0;
  let ch2QuarterCount = 0;

  // Prognose-Frames sind Viertelstunden-Zustände für den kompletten Horizont:
  // direkter 15-min-Modellwert falls vorhanden, ansonsten linearer Wert-Fallback
  // zwischen benachbarten Stunden. Keine Wind-Advektion und keine frei erzeugte
  // Eigenbewegung im Backend.
  const start15 = Math.floor(now / 900_000) * 900_000 + 900_000;
  for (let tMs = start15; tMs <= forecastCutoff; tMs += 900_000) {
    const grid = getForecastExact(tMs) ?? interpolateForecast(tMs);
    if (!grid) continue;
    frames.push({
      t: new Date(tMs).toISOString(),
      source: grid.source,
      values: grid.precip,
      snowValues: emitSnow ? grid.snow ?? new Array<number>(nPts).fill(0) : undefined,
    });
    if (grid.source === "icon-ch1") ch1QuarterCount++;
    else ch2QuarterCount++;
  }


  console.info(
    `[radar] forecast: ch1Quarter=${ch1QuarterCount} ch2Quarter=${ch2QuarterCount}`,
  );



  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  if (frames.length === 0) {
    const warning =
      warnings.length > 0
        ? `Radardaten nicht verfügbar: ${warnings.join("; ")}`
        : "Radardaten nicht verfügbar";
    console.warn(`[radar] ${warning}`);
    return {
      bbox: BBOX,
      imageBbox,
      gridLat: lats,
      gridLon: lons,
      frames: [],
      generatedAt: new Date().toISOString(),
      hasRealRadar: false,
      hasHail: false,
      warning,
    } satisfies RadarPayload;
  }


  // R2-PNG-URLs auf Same-Origin-Proxy umschreiben, damit der Browser sie als
  // `crossOrigin="anonymous"` ohne Canvas-Taint lesen kann.
  const toProxy = (raw?: string): string | undefined => {
    if (!raw) return raw;
    try {
      const u = new URL(raw);
      const m = u.pathname.match(/\/(radar\/[A-Za-z0-9._\-\/]+\.png)$/i);
      if (!m) return raw;
      return `/api/public/radar/proxy?path=${encodeURIComponent(m[1])}`;
    } catch {
      return raw;
    }
  };
  for (const f of frames) {
    if (f.precipUrl) f.precipUrl = toProxy(f.precipUrl);
    if (f.hailUrl) f.hailUrl = toProxy(f.hailUrl);
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
