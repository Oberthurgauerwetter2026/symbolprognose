import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache, type OpenMeteoCachePayload } from "./openmeteo-cache.server";


/**
 * Radar-Frames für die Region Oberthurgau.
 *
 * Vergangenheit (≤ now):
 *   - Bevorzugt: echte MeteoSchweiz-CPC- / POH-PNGs aus Cloudflare R2
 *     (befüllt durch `scripts/ingest_radar.py` via GitHub Actions).
 *   - Fallback: ICON-CH1 minutely_15.precipitation als interpoliertes
 *     Punkt-Grid (kein echtes Radar).
 *
 * Vorhersage (> now):
 *   - ICON-CH1 (+33h, 15-min Raster)
 *   - ICON-CH2 (+120h, 1-h Raster)
 *
 * Alle Open-Meteo-Daten werden NICHT vom Worker live abgerufen, sondern
 * alle 5 Minuten via GitHub Actions (`scripts/ingest_openmeteo.py`) in R2
 * unter `openmeteo/forecast.json` gecached. Damit teilt sich kein Besucher-
 * traffic mehr die Open-Meteo-Free-Tier-Quote.
 */


// Bounding-Box passend zur Region (auch im Python-Ingest verwendet).
const BBOX = { minLat: 47.30, maxLat: 47.85, minLon: 8.85, maxLon: 9.85 } as const;
const GRID_LON = 20;
const GRID_LAT = 12;

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

export interface RadarFrame {
  t: string; // ISO UTC
  source: "radar" | "icon-ch1" | "icon-ch2";
  /** Niederschlag mm/h pro Grid-Punkt (row-major). Bei `imageUrl`-Frames leer. */
  values: number[];
  /** Schnee-Wasser-Äquivalent mm/h pro Grid-Punkt (row-major). Leer = unbekannt. */
  snowValues?: number[];
  /** Wenn gesetzt, als ImageOverlay rendern statt Canvas (echte MCH-Daten). */
  precipUrl?: string;
  /** Optionaler Hagel-Overlay (POH %) URL. */
  hailUrl?: string;
}

export interface RadarPayload {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  /** Bbox der R2-PNG-Overlays (falls verfügbar, sonst = bbox). */
  imageBbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  gridLat: number[];
  gridLon: number[];
  frames: RadarFrame[];
  generatedAt: string;
  /** True, wenn echte MeteoSchweiz-Radar-PNGs verwendet werden. */
  hasRealRadar: boolean;
  /** True, wenn POH-Hagel-Layer verfügbar ist. */
  hasHail: boolean;
  /** Hinweis, falls einzelne Datenquellen temporär nicht verfügbar sind. */
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
  hourly?: { time: string[]; precipitation: (number | null)[] };
};

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

  const { lats, lons, pts } = buildGrid();

  const [cacheRes, manifestRes] = await Promise.allSettled([
    fetchOpenMeteoCache(),
    fetchR2Manifest(),
  ]);

  const cache = cacheRes.status === "fulfilled" ? cacheRes.value : null;
  const r1 = cache?.phase1 ?? null;
  const manifest = manifestRes.status === "fulfilled" ? manifestRes.value : null;

  const warnings: string[] = [];
  if (!cache) {
    warnings.push("Open-Meteo-Cache temporär nicht verfügbar");
  }


  const now = Date.now();
  const forecastCutoff = now + 32 * 3600 * 1000;
  const pastCutoff = now - 6 * 3600 * 1000;
  const frames: RadarFrame[] = [];

  // ---- Vergangenheit ----
  const hasRealRadar = !!manifest && manifest.frames.length > 0;
  const hasHail = hasRealRadar && manifest!.frames.some((f) => f.hailUrl);
  const imageBbox = manifest?.bbox ?? BBOX;

  if (hasRealRadar) {
    for (const mf of manifest!.frames) {
      const tMs = Date.parse(mf.t);
      if (tMs > now) continue;
      if (tMs < pastCutoff) continue; // nur letzte 6 h MCH-Messung
      frames.push({
        t: mf.t,
        source: "radar",
        values: [],
        precipUrl: mf.precipUrl,
        hailUrl: mf.hailUrl,
      });
    }
  }

  // ---- Phase 1 (Open-Meteo): Fallback-Past + ICON-CH1-Future (bis +32h) ----
  const ref1 = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;
  if (ref1 && r1) {
    const hasSnow = Array.isArray((r1[0] as LocResponse | undefined)?.minutely_15?.snowfall);
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= now && hasRealRadar) continue;
      if (tMs > forecastCutoff) continue;
      const values: number[] = new Array(pts.length);
      const snowValues: number[] | undefined = hasSnow ? new Array(pts.length) : undefined;
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const v = loc?.minutely_15?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v * 4 : 0;
        if (snowValues) {
          // Open-Meteo snowfall ist cm/15min; *10 → mm Schneetiefe, *(1mm Wasser/10mm Schnee) = 1
          // Also: snowfall_cm * 4 → mm Wasser-Äquivalent/h (Faustregel 1cm Schnee ≈ 1mm Wasser).
          const s = loc?.minutely_15?.snowfall?.[ti];
          snowValues[pi] = typeof s === "number" ? s * 4 : 0;
        }
      }
      const source: RadarFrame["source"] = tMs <= now ? "radar" : "icon-ch1";
      frames.push({ t: tIso, source, values, snowValues });
    }
  }

  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  // ---- 15-min-Smoothing für Forecast-Frames ----
  // Open-Meteo liefert für `meteoswiss_icon_ch1` in minutely_15 effektiv stündliche
  // Werte (4× wiederholt). Wir interpolieren linear zwischen den Stunden-Ankern,
  // damit jeder 15-min-Slot einen eigenen Zwischenwert trägt.
  const forecastFrames = frames.filter((f) => f.source === "icon-ch1");
  if (forecastFrames.length >= 2) {
    // Anker-Indizes: Frames mit Minute :00 (UTC).
    const anchorIdx: number[] = [];
    for (let i = 0; i < forecastFrames.length; i++) {
      if (new Date(forecastFrames[i].t).getUTCMinutes() === 0) anchorIdx.push(i);
    }
    if (anchorIdx.length >= 2) {
      const interp = (key: "values" | "snowValues") => {
        for (let a = 0; a < anchorIdx.length - 1; a++) {
          const iA = anchorIdx[a];
          const iB = anchorIdx[a + 1];
          const span = iB - iA;
          if (span <= 1) continue;
          const arrA = forecastFrames[iA][key];
          const arrB = forecastFrames[iB][key];
          if (!arrA || !arrB) continue;
          for (let k = 1; k < span; k++) {
            const t = k / span;
            const target = forecastFrames[iA + k][key];
            if (!target) continue;
            for (let pi = 0; pi < target.length; pi++) {
              target[pi] = arrA[pi] * (1 - t) + arrB[pi] * t;
            }
          }
        }
      };
      interp("values");
      interp("snowValues");
    }
  }


  // Wenn wir überhaupt keine Frames haben, hart fehlschlagen, damit die UI
  // den Fehlerzustand anzeigt.
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

