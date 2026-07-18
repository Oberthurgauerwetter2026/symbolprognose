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

function locHasMinutely(loc: unknown): loc is LocResponse & {
  minutely_15: { time: string[]; precipitation: (number | null)[]; snowfall?: (number | null)[] };
} {
  const m = (loc as LocResponse | undefined)?.minutely_15;
  return Array.isArray(m?.time) && Array.isArray(m?.precipitation);
}

function locHasHourly(loc: unknown): loc is LocResponse & {
  hourly: { time: string[]; precipitation: (number | null)[]; snowfall?: (number | null)[] };
} {
  const h = (loc as LocResponse | undefined)?.hourly;
  return Array.isArray(h?.time) && Array.isArray(h?.precipitation);
}

function referenceMinutely(locations: LocResponse[] | null): LocResponse["minutely_15"] | null {
  if (!locations) return null;
  for (const loc of locations) {
    if (locHasMinutely(loc) && loc.minutely_15.time.length > 0) return loc.minutely_15;
  }
  return null;
}

function referenceHourly(locations: LocResponse[] | null): LocResponse["hourly"] | null {
  if (!locations) return null;
  for (const loc of locations) {
    if (locHasHourly(loc) && loc.hourly.time.length > 0) return loc.hourly;
  }
  return null;
}

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


  const [cacheRes, manifestRes, forecastManifestRes] = await Promise.allSettled([
    fetchOpenMeteoCache(),
    fetchR2Manifest(),
    fetchR2ForecastManifest(),
  ]);

  const cache = cacheRes.status === "fulfilled" ? cacheRes.value : null;
  const manifest = manifestRes.status === "fulfilled" ? manifestRes.value : null;
  const forecastManifest =
    forecastManifestRes.status === "fulfilled" ? forecastManifestRes.value : null;

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

  // ---- Prognose: ICON-CH1 als vor-gerasterte PNGs (native ~1 km) ----
  // Der `openmeteo`-Ingest schreibt für jeden 15-min-Slot ein PNG mit
  // identischer Farbskala und Bbox wie die Messung. Damit haben Prognose- und
  // Messungs-Frames pixelgenau dieselbe Optik im Client.
  const hasForecastPngs =
    !!forecastManifest && forecastManifest.frames.some((f) => !!f.precipUrl);
  const forecastImageBbox = forecastManifest?.bbox ?? BBOX;

  if (!hasForecastPngs) {
    warnings.push("Prognose-PNGs (ICON-CH1) temporär nicht verfügbar");
  } else {
    // Zeit-Index aus ICON-CH1 minutely_15, um Prognose-Frames zusätzlich mit
    // numerischen mm/h-Werten pro Grid-Punkt zu befüllen. Die Summenkarte
    // (`/karten/niederschlag`) hat keinen PNG-Pfad und braucht `values`.
    const ref1Fc = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;
    const hasFcSnow = Array.isArray(
      (r1?.[0] as LocResponse | undefined)?.minutely_15?.snowfall,
    );
    const fcTimeIdx = new Map<number, number>();
    if (ref1Fc?.time) {
      for (let ti = 0; ti < ref1Fc.time.length; ti++) {
        fcTimeIdx.set(Date.parse(ref1Fc.time[ti] + "Z"), ti);
      }
    }
    const findFcIdx = (tMs: number): number => {
      const exact = fcTimeIdx.get(tMs);
      if (typeof exact === "number") return exact;
      let best = -1;
      let bestDt = 10 * 60_000 + 1;
      for (const [tm, idx] of fcTimeIdx) {
        const dt = Math.abs(tm - tMs);
        if (dt < bestDt) {
          bestDt = dt;
          best = idx;
        }
      }
      return best;
    };

    let ch1Count = 0;
    let ch1WithValues = 0;
    for (const mf of forecastManifest!.frames) {
      const tMs = Date.parse(mf.t);
      if (Number.isNaN(tMs)) continue;
      if (tMs <= now) continue;
      if (tMs > forecastCutoff) continue;

      let values: number[] = [];
      let snowValues: number[] | undefined;
      if (r1 && fcTimeIdx.size > 0) {
        const ti = findFcIdx(tMs);
        if (ti >= 0) {
          values = new Array(pts.length);
          if (hasFcSnow) snowValues = new Array(pts.length);
          for (let pi = 0; pi < pts.length; pi++) {
            const loc = r1[pi] as LocResponse | undefined;
            const v = loc?.minutely_15?.precipitation?.[ti];
            values[pi] = typeof v === "number" ? v * 4 : 0;
            if (snowValues) {
              const s = loc?.minutely_15?.snowfall?.[ti];
              snowValues[pi] = typeof s === "number" ? s * 4 : 0;
            }
          }
          ch1WithValues++;
        }
      }

      frames.push({
        t: mf.t,
        source: mf.source ?? "icon-ch1",
        sourceT: mf.t,
        values,
        snowValues,
        precipUrl: mf.precipUrl,
        imageBbox: forecastImageBbox,
      });
      ch1Count++;
    }
    console.info(
      `[radar] forecast pngs: ${ch1Count} frames (${ch1WithValues} mit Grid-Werten)`,
    );
  }

  // ---- Fallback: Modell-Prognose direkt aus openmeteo/forecast.json ----
  // Wenn das vorgerasterte Forecast-Manifest noch fehlt, darf die Timeline
  // nicht bei der Messung enden. Dann rendern wir die vorhandenen ICON-CH1-
  // Werte als Canvas-Frames. Sobald Forecast-PNGs vorhanden sind, bleibt der
  // native PNG-Pfad oben maßgebend.
  if (!hasForecastPngs && r1) {
    const ref = referenceMinutely(r1 as LocResponse[]);
    let fallbackCount = 0;
    if (ref?.time?.length) {
      const hasSnow = Array.isArray(ref.snowfall);
      for (let ti = 0; ti < ref.time.length; ti++) {
        const tMs = Date.parse(`${ref.time[ti]}Z`);
        if (Number.isNaN(tMs)) continue;
        if (tMs <= now) continue;
        if (tMs > forecastCutoff) continue;

        const values = new Array<number>(pts.length);
        const snowValues = hasSnow ? new Array<number>(pts.length) : undefined;
        for (let pi = 0; pi < pts.length; pi++) {
          const loc = r1[pi] as LocResponse | undefined;
          const v = loc?.minutely_15?.precipitation?.[ti];
          values[pi] = typeof v === "number" ? v * 4 : 0;
          if (snowValues) {
            const s = loc?.minutely_15?.snowfall?.[ti];
            snowValues[pi] = typeof s === "number" ? s * 4 : 0;
          }
        }

        frames.push({
          t: new Date(tMs).toISOString(),
          source: "icon-ch1",
          sourceT: new Date(tMs).toISOString(),
          values,
          snowValues,
        });
        fallbackCount++;
      }
    }
    if (fallbackCount > 0) {
      console.info(`[radar] forecast fallback from ICON-CH1 grid: ${fallbackCount} frames`);
      warnings.push("Prognose läuft vorübergehend im Modellraster, bis die hochaufgelösten PNGs neu erzeugt sind");
    }
  }

  // ICON-CH2 hourly erweitert den Fallback, wenn CH1-Minutely vor +48 h endet.
  if (!hasForecastPngs && r2) {
    const latestForecastMs = frames.reduce((latest, f) => {
      if (f.source === "radar") return latest;
      const tMs = Date.parse(f.t);
      return Number.isNaN(tMs) ? latest : Math.max(latest, tMs);
    }, now);
    const ref = referenceHourly(r2 as LocResponse[]);
    let ch2Count = 0;
    if (ref?.time?.length) {
      const hasSnow = Array.isArray(ref.snowfall);
      for (let ti = 0; ti < ref.time.length; ti++) {
        const tMs = Date.parse(`${ref.time[ti]}Z`);
        if (Number.isNaN(tMs)) continue;
        if (tMs <= latestForecastMs + 10 * 60_000) continue;
        if (tMs > forecastCutoff) continue;

        const values = new Array<number>(pts.length);
        const snowValues = hasSnow ? new Array<number>(pts.length) : undefined;
        for (let pi = 0; pi < pts.length; pi++) {
          const loc = r2[pi] as LocResponse | undefined;
          const v = loc?.hourly?.precipitation?.[ti];
          values[pi] = typeof v === "number" ? v : 0;
          if (snowValues) {
            const s = loc?.hourly?.snowfall?.[ti];
            snowValues[pi] = typeof s === "number" ? s : 0;
          }
        }
        frames.push({
          t: new Date(tMs).toISOString(),
          source: "icon-ch2",
          sourceT: new Date(tMs).toISOString(),
          values,
          snowValues,
        });
        ch2Count++;
      }
    }
    if (ch2Count > 0) console.info(`[radar] forecast fallback from ICON-CH2 grid: ${ch2Count} frames`);
  }





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
