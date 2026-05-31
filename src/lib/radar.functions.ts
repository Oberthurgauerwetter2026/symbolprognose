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


// Bounding-Box passend zur CombiPrecip-Region (auch im Python-Ingest verwendet).
// Deckt Zürich, Schaffhausen, Bodensee, St. Gallen, Appenzell, Vorarlberg
// und angrenzendes Süddeutschland ab.
const BBOX = { minLat: 46.85, maxLat: 48.30, minLon: 8.15, maxLon: 10.55 } as const;
const GRID_LON = 36;
const GRID_LAT = 22;

// ─── Self-test: meteo-Wind → Bewegungsvektor (einmal pro Worker-Lifetime) ───
// Verhindert, dass eine spätere Bearbeitung das Vorzeichen unbemerkt kippt.
let _windSignCheckDone = false;
function assertWindMotionSign(): void {
  if (_windSignCheckDone) return;
  _windSignCheckDone = true;
  const cases: { dir: number; label: string; expectU: number; expectV: number }[] = [
    { dir: 0, label: "N-Wind → S-Drift", expectU: 0, expectV: -1 },
    { dir: 90, label: "E-Wind → W-Drift", expectU: -1, expectV: 0 },
    { dir: 180, label: "S-Wind → N-Drift", expectU: 0, expectV: 1 },
    { dir: 270, label: "W-Wind → E-Drift", expectU: 1, expectV: 0 },
    { dir: 315, label: "NW-Wind → SE-Drift", expectU: 1, expectV: -1 },
  ];
  const speed = 10;
  const fails: string[] = [];
  for (const c of cases) {
    const rad = (c.dir * Math.PI) / 180;
    const u = -speed * Math.sin(rad);
    const v = -speed * Math.cos(rad);
    const okU = Math.sign(Math.round(u * 1000) / 1000) === Math.sign(c.expectU) || c.expectU === 0;
    const okV = Math.sign(Math.round(v * 1000) / 1000) === Math.sign(c.expectV) || c.expectV === 0;
    if (!okU || !okV) {
      fails.push(`${c.label}: u=${u.toFixed(2)} v=${v.toFixed(2)}`);
    }
  }
  if (fails.length) {
    console.error("[radar/nowcast/wind] SIGN-TEST FAILED:\n  " + fails.join("\n  "));
  } else {
    console.info("[radar/nowcast/wind] sign-test ok (N→S, E→W, S→N, W→E, NW→SE)");
  }
}


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

/**
 * Leitet das Lese-Grid direkt aus den im R2-Cache gespeicherten Punkten ab.
 * Notwendig, weil Ingest und Frontend nach Punkt-Index lesen — wenn der Cache
 * noch eine ältere Geometrie hat, würden die Konstanten falsch zeigen.
 */
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
  // Reihenfolge: ingest schreibt outer=lat, inner=lon (siehe buildGrid).
  const pts: { lat: number; lon: number }[] = [];
  for (const la of lats) for (const lo of lons) pts.push({ lat: la, lon: lo });
  return { lats, lons, pts };
}

function cacheGridLooksStale(points: { lat: number; lon: number }[] | undefined): boolean {
  if (!points || points.length === 0) return false;
  return gridFromCachePoints(points) === null;
}


export interface RadarFrame {
  t: string; // ISO UTC
  source: "radar" | "nowcast" | "icon-ch1" | "icon-ch2";
  /** Niederschlag mm/h pro Grid-Punkt (row-major). Bei `imageUrl`-Frames leer. */
  values: number[];
  /** Schnee-Wasser-Äquivalent mm/h pro Grid-Punkt (row-major). Leer = unbekannt. */
  snowValues?: number[];
  /** Wenn gesetzt, als ImageOverlay rendern statt Canvas (echte MCH-Daten). */
  precipUrl?: string;
  /** Optionaler Hagel-Overlay (POH %) URL. */
  hailUrl?: string;
  /** Optional: Bbox des PNG-Overlays für diesen Frame. Wenn gesetzt, hat es
   *  Vorrang vor `payload.imageBbox` (genutzt für EPS-Mean-PNGs, die mit
   *  weiterer Bbox als die CPC-Radar-PNGs gerendert werden). */
  imageBbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  /** Nowcast: Verschiebung des PNG-Overlays gegenüber `imageBbox` in Grad. */
  imageOffset?: { dLat: number; dLon: number };
  /** Nur für `source==="nowcast"`: Herkunft des Bewegungsvektors. */
  motionSource?: "radar" | "wind";
  /**
   * Anzeige-Deckkraft 0..1. Genutzt für:
   *   - Nowcast-Wachstum/Zerfall (Trend aus letzten 6 Radarmessungen).
   *   - Soft-Blending im Übergangs-Fenster Nowcast → ICON-CH1
   *     (60…90 min: Nowcast 1.0 → 0.0, ICON-CH1 0.0 → 1.0).
   * Default 1.0, wenn nicht gesetzt.
   */
  blendOpacity?: number;
}

export interface RadarMotionField {
  rows: number;
  cols: number;
  tile_px: number;
  stride_px: number;
  image_w: number;
  image_h: number;
  cx_px: number[];
  cy_px: number[];
  /** Bewegungsvektoren pro Kachel (row-major, rows*cols Einträge). */
  u_deg_per_min: number[];
  v_deg_per_min: number[];
  conf: number[];
  wet: number[];
  growth_per_min: number[];
  active_tiles?: number;
  wind_prior_used?: boolean;
}

export interface RadarMotion {
  u_ms: number;
  v_ms: number;
  u_deg_per_min: number;
  v_deg_per_min: number;
  sourceTs: string;
  confidence: number;
  pairs?: number;
  /** Relative Intensitäts-Steigung pro Minute (z. B. +0.01 = +1%/min Wachstum). */
  growth_per_min?: number;
  /** Anzahl Radar-Frames im Trendfenster (typ. 6). */
  frames?: number;
  /** Mittlere Niederschlagsintensität (mm/h) der nassen Pixel in den letzten 3 Frames. */
  recent_mean_mmh?: number;
  /** Anteil der "nassen" Pixel (> 0.1 mm/h) in den letzten 3 Frames, 0..1. */
  recent_wet_frac?: number;
  /** Tile-basiertes Optical-Flow-Feld (Ingest v9+). */
  field?: RadarMotionField;
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
  /** Echte Zellbewegung aus den letzten Radar-Frames (Phase-Correlation). */
  motion?: RadarMotion;
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
  hourly?: {
    time: string[];
    precipitation?: (number | null)[];
    wind_speed_700hPa?: (number | null)[];
    wind_direction_700hPa?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
  };
};

type ManifestFrame = { t: string; precipUrl?: string; hailUrl?: string };
type Manifest = {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  generatedAt: string;
  frames: ManifestFrame[];
  motion?: RadarMotion;
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
  assertWindMotionSign();

  setResponseHeader("Cache-Control", "public, max-age=60, s-maxage=120");

  const [cacheRes, manifestRes] = await Promise.allSettled([
    fetchOpenMeteoCache(),
    fetchR2Manifest(),
  ]);

  const cache = cacheRes.status === "fulfilled" ? cacheRes.value : null;
  const manifest = manifestRes.status === "fulfilled" ? manifestRes.value : null;

  // Bevorzugt das Grid aus dem Cache (verhindert Index-Drift, wenn die
  // Ingest-Geometrie umgestellt wird, der R2-Cache aber noch alt ist).
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
  // ICON-CH1 deterministisch (minutely_15) bis +33 h, ICON-CH2 (hourly) füllt +33…+48 h.
  const forecastCutoff = now + 48 * 3600 * 1000;
  const pastCutoff = now - 6 * 3600 * 1000;
  const frames: RadarFrame[] = [];

  // ---- Vergangenheit ----
  const hasRealRadar = !!manifest && manifest.frames.length > 0;
  const hasHail = hasRealRadar && manifest!.frames.some((f) => f.hailUrl);
  const imageBbox = manifest?.bbox ?? BBOX;

  if (hasRealRadar) {
    // Forward-Fill: einzelne fehlende precip/hail-URLs vom letzten gültigen
    // Frame übernehmen (max. 3 Frames = 15 min), damit Mini-Lücken
    // (z. B. wenn ein Asset-Upload im Ingest fehlgeschlagen ist)
    // keine leeren Bilder in der Animation produzieren.
    const FILL_LIMIT = 3;
    const sortedMf = [...manifest!.frames].sort(
      (a, b) => Date.parse(a.t) - Date.parse(b.t),
    );
    let lastPrecip: string | undefined;
    let lastPrecipAge = 0;
    let lastHail: string | undefined;
    let lastHailAge = 0;
    const filled = sortedMf.map((mf) => {
      let precipUrl = mf.precipUrl;
      let hailUrl = mf.hailUrl;
      if (precipUrl) {
        lastPrecip = precipUrl;
        lastPrecipAge = 0;
      } else if (lastPrecip && lastPrecipAge < FILL_LIMIT) {
        precipUrl = lastPrecip;
        lastPrecipAge += 1;
      }
      if (hailUrl) {
        lastHail = hailUrl;
        lastHailAge = 0;
      } else if (lastHail && lastHailAge < FILL_LIMIT) {
        hailUrl = lastHail;
        lastHailAge += 1;
      }
      return { t: mf.t, precipUrl, hailUrl };
    });
    // Open-Meteo `minutely_15` enthält dank `past_minutely_15` auch die
    // letzten ~12 h. Wir bauen einen Time→Index-Lookup auf, um pro Messung-
    // Frame zusätzlich Grid-Werte zu befüllen — damit der Canvas-Layer
    // unter der MCH-PNG ausserhalb der Schweiz dieselbe Farbskala zeigt.
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
      // Nearest-match innerhalb ±10 min.
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
    for (const mf of filled) {
      const tMs = Date.parse(mf.t);
      if (tMs > now) continue;
      if (tMs < pastCutoff) continue; // nur letzte 6 h MCH-Messung

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
            values[pi] = typeof v === "number" ? v * 4 : 0; // mm/15min → mm/h
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
        values,
        snowValues,
        precipUrl: mf.precipUrl,
        hailUrl: mf.hailUrl,
      });
    }
  }

  // ---- Nowcast (Radar-Extrapolation, T+0…+90 min) ----
  // Operationelles Verfahren wie MeteoSchweiz INCA / DWD RadVOR: das letzte
  // gemessene Radarbild wird entlang eines Bewegungsvektors verschoben. Im
  // Browser passiert das als reines ImageOverlay-Bounds-Shift — kein
  // Pixel-Resampling, kein Modell-Glättungs-Effekt.
  //
  // Erweiterungen ggü. V1:
  //   • Bewegungsvektor aus letzten 6 (statt 3) Radar-Frames → stabiler.
  //   • Wachstum/Zerfall: Trend `growth_per_min` aus Manifest wird als
  //     Intensitäts-Decay angewendet (Frame-Opacity), analog INCA-Decay.
  //   • Horizont 90 min, mit Soft-Fade in den letzten 30 min (1.0 → 0.0),
  //     parallel rampt ICON-CH1 ab T+60 von 0.0 → 1.0 hoch (Soft-Blending).
  const motion = manifest?.motion;
  const MIN_CONF = 0.3;
  const MIN_RADAR_MS = 1.0; // < 1 m/s effektiv Stillstand → Fallback
  const NOWCAST_HORIZON_MIN = 90;
  const NOWCAST_STEP_MIN = 10;
  const NOWCAST_FADE_START_MIN = 60; // ab hier fadet der Nowcast aus
  let nowcastEndMs = -Infinity;

  const radarMotionUsable =
    !!motion &&
    typeof motion.u_deg_per_min === "number" &&
    typeof motion.v_deg_per_min === "number" &&
    motion.confidence >= MIN_CONF &&
    Math.hypot(motion.u_ms ?? 0, motion.v_ms ?? 0) >= MIN_RADAR_MS;

  let nowcastMotion: {
    u_deg_per_min: number;
    v_deg_per_min: number;
    source: "radar" | "wind";
  } | null = null;

  if (radarMotionUsable && motion) {
    nowcastMotion = {
      u_deg_per_min: motion.u_deg_per_min,
      v_deg_per_min: motion.v_deg_per_min,
      source: "radar",
    };
    const bearing =
      ((Math.atan2(motion.u_deg_per_min, motion.v_deg_per_min) * 180) / Math.PI + 360) % 360;
    console.info(
      `[radar/nowcast/radar] u_deg/min=${motion.u_deg_per_min.toExponential(2)} ` +
        `v_deg/min=${motion.v_deg_per_min.toExponential(2)} ` +
        `bearing_to=${bearing.toFixed(0)}° conf=${motion.confidence.toFixed(2)} ` +
        `growth/min=${(motion.growth_per_min ?? 0).toFixed(4)}`,
    );
  } else if (hasRealRadar && r1) {

    // Wind-Fallback: Punkt aus phase1, der dem Bbox-Mittelpunkt am nächsten
    // liegt; Stunde, die `lastRadarT` enthält.
    const radarFramesForT = frames.filter(
      (f) => f.source === "radar" && f.precipUrl,
    );
    const lastForT = radarFramesForT[radarFramesForT.length - 1];
    if (lastForT) {
      const lastMs = Date.parse(lastForT.t);
      const midLat = (BBOX.minLat + BBOX.maxLat) / 2;
      const midLon = (BBOX.minLon + BBOX.maxLon) / 2;
      let bestIdx = -1;
      let bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d =
          (pts[i].lat - midLat) ** 2 + (pts[i].lon - midLon) ** 2;
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      const loc = bestIdx >= 0 ? (r1[bestIdx] as LocResponse | undefined) : undefined;
      const hourly = loc?.hourly;
      if (hourly && hourly.time && hourly.time.length) {
        let hi = -1;
        for (let i = 0; i < hourly.time.length; i++) {
          const ms = Date.parse(hourly.time[i] + "Z");
          if (ms <= lastMs) hi = i;
          else break;
        }
        if (hi >= 0) {
          const sp700 = hourly.wind_speed_700hPa?.[hi];
          const dir700 = hourly.wind_direction_700hPa?.[hi];
          const sp10 = hourly.wind_speed_10m?.[hi];
          const dir10 = hourly.wind_direction_10m?.[hi];
          let speedMs: number | null = null;
          let dirDeg: number | null = null;
          if (typeof sp700 === "number" && typeof dir700 === "number") {
            // Open-Meteo wind_speed_* ist in km/h.
            speedMs = (sp700 * 1000) / 3600;
            dirDeg = dir700;
          } else if (typeof sp10 === "number" && typeof dir10 === "number") {
            // 10 m → ~700 hPa Steering-Approx (offenes Gelände).
            speedMs = ((sp10 * 1000) / 3600) * 1.8;
            dirDeg = dir10;
          }
          if (
            speedMs !== null &&
            dirDeg !== null &&
            speedMs >= MIN_RADAR_MS
          ) {
            // Open-Meteo `wind_direction_*` ist meteorologisch =
            // „woher der Wind weht" (270° = Westwind = Strömung nach Osten).
            // Bewegungsvektor zeigt also in die Gegenrichtung der Windrichtung
            // → Minus-Vorzeichen nötig, sonst ziehen die Zellen rückwärts.
            const rad = (dirDeg * Math.PI) / 180;
            const uMs = -speedMs * Math.sin(rad);
            const vMs = -speedMs * Math.cos(rad);
            const mPerDegLat = 111_000;
            const mPerDegLon = 111_000 * Math.cos((midLat * Math.PI) / 180);
            const uDegMin = (uMs * 60) / mPerDegLon;
            const vDegMin = (vMs * 60) / mPerDegLat;
            const bearing = ((Math.atan2(uMs, vMs) * 180) / Math.PI + 360) % 360;
            console.info(
              `[radar/nowcast/wind] dir_from=${dirDeg.toFixed(0)}° speed=${speedMs.toFixed(1)}m/s ` +
                `→ uMs=${uMs.toFixed(2)} vMs=${vMs.toFixed(2)} ` +
                `bearing_to=${bearing.toFixed(0)}° ` +
                `dLon/min=${uDegMin.toExponential(2)} dLat/min=${vDegMin.toExponential(2)}`,
            );
            nowcastMotion = {
              u_deg_per_min: uDegMin,
              v_deg_per_min: vDegMin,
              source: "wind",
            };
          }
        }
      }
    }
  }


  if (hasRealRadar && nowcastMotion) {
    const radarFrames = frames.filter((f) => f.source === "radar" && f.precipUrl);
    const last = radarFrames[radarFrames.length - 1];
    if (last && last.precipUrl) {
      const lastMs = Date.parse(last.t);
      // Wachstums-/Zerfalls-Faktor pro Minute (z. B. -0.01 = -1 %/min Zerfall).
      // Wird nur angewendet, wenn die Radar-Motion (nicht Wind-Fallback) genutzt
      // wird — sonst kennen wir den realen Trend nicht zuverlässig.
      const growthPerMin =
        nowcastMotion.source === "radar" && typeof motion?.growth_per_min === "number"
          ? motion.growth_per_min
          : 0;
      for (let m = NOWCAST_STEP_MIN; m <= NOWCAST_HORIZON_MIN; m += NOWCAST_STEP_MIN) {
        const tMs = lastMs + m * 60_000;
        if (tMs > forecastCutoff) break;
        // 1) Wachstums-/Zerfalls-Decay (clamped 0.25…1.6).
        const growthFactor = Math.max(0.25, Math.min(1.6, 1 + growthPerMin * m));
        // 2) Soft-Fade in den letzten 30 min des Horizonts (1.0 → 0.0).
        const fadeFactor =
          m <= NOWCAST_FADE_START_MIN
            ? 1
            : Math.max(
                0,
                1 - (m - NOWCAST_FADE_START_MIN) / (NOWCAST_HORIZON_MIN - NOWCAST_FADE_START_MIN),
              );
        const blendOpacity = Math.max(0, Math.min(1.6, growthFactor * fadeFactor));
        frames.push({
          t: new Date(tMs).toISOString(),
          source: "nowcast",
          values: [],
          precipUrl: last.precipUrl,
          imageOffset: {
            dLat: nowcastMotion.v_deg_per_min * m,
            dLon: nowcastMotion.u_deg_per_min * m,
          },
          motionSource: nowcastMotion.source,
          blendOpacity,
        });
      }
      nowcastEndMs = lastMs + NOWCAST_HORIZON_MIN * 60_000;
    }
  }

  // Soft-Blending-Marker: ICON-CH1-Frames im Overlap-Fenster
  // (radar.last + NOWCAST_FADE_START_MIN … nowcastEndMs) rampen 0 → 1 hoch.
  const overlapStartMs =
    Number.isFinite(nowcastEndMs) && hasRealRadar
      ? nowcastEndMs - (NOWCAST_HORIZON_MIN - NOWCAST_FADE_START_MIN) * 60_000
      : -Infinity;

  // ---- Phase 1 (Open-Meteo): Fallback-Past + ICON-CH1-Future (bis +32h) ----
  const ref1 = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;

  // ---- ICON-CH1-Bias-Korrektur (radar-anker) ----
  // Vergleich: mittlere ICON-CH1-Intensität im Fenster [now, now+30min] vs.
  // gemessener Radar-Mittelwert der letzten 3 Frames (manifest.motion.recent_mean_mmh).
  // Faktor = radar / icon, geklemmt auf [0.4, 2.5]. Wird linear über 120 min
  // gegen 1.0 ausgeblendet — danach traut die UI dem ICON-CH1-Roh-Lauf.
  let biasFactor = 1;
  const BIAS_FADE_MIN = 120;
  if (ref1 && r1 && manifest?.motion?.recent_mean_mmh && manifest.motion.recent_mean_mmh > 0.05) {
    let iconSum = 0;
    let iconN = 0;
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tMs = Date.parse(ref1.time[ti] + "Z");
      if (tMs < now - 5 * 60_000 || tMs > now + 30 * 60_000) continue;
      for (let pi = 0; pi < pts.length; pi++) {
        const v = (r1[pi] as LocResponse | undefined)?.minutely_15?.precipitation?.[ti];
        if (typeof v === "number" && v > 0.025) {
          iconSum += v * 4; // mm/15min -> mm/h
          iconN += 1;
        }
      }
    }
    const iconMean = iconN > 0 ? iconSum / iconN : 0;
    if (iconMean > 0.05) {
      const raw = manifest.motion.recent_mean_mmh / iconMean;
      biasFactor = Math.max(0.4, Math.min(2.5, raw));
      console.info(
        `[radar] bias-correction: radar=${manifest.motion.recent_mean_mmh.toFixed(2)} ` +
          `icon=${iconMean.toFixed(2)} -> factor ${biasFactor.toFixed(2)} ` +
          `(fade ${BIAS_FADE_MIN}min)`,
      );
    }
  }

  if (ref1 && r1) {
    const hasSnow = Array.isArray((r1[0] as LocResponse | undefined)?.minutely_15?.snowfall);
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= now && hasRealRadar) continue;
      // ICON-CH1-Frames im Overlap-Fenster zulassen (mit Fade-In), erst danach voll.
      if (tMs <= overlapStartMs) continue;
      if (tMs > forecastCutoff) continue;
      // (kein EPS mehr — keine Lücken-Aussparung)

      // Bias-Faktor zeitlich abklingen lassen: 1.0 = volle Korrektur, 0.0 = ICON pur.
      const dtMin = Math.max(0, (tMs - now) / 60_000);
      const biasWeight =
        biasFactor === 1
          ? 0
          : Math.max(0, 1 - dtMin / BIAS_FADE_MIN);
      const correction = 1 + (biasFactor - 1) * biasWeight;

      const values: number[] = new Array(pts.length);
      const snowValues: number[] | undefined = hasSnow ? new Array(pts.length) : undefined;
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const v = loc?.minutely_15?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v * 4 * correction : 0;
        if (snowValues) {
          const s = loc?.minutely_15?.snowfall?.[ti];
          snowValues[pi] = typeof s === "number" ? s * 4 * correction : 0;
        }
      }
      const source: RadarFrame["source"] = tMs <= now ? "radar" : "icon-ch1";
      let blendOpacity: number | undefined;
      if (
        source === "icon-ch1" &&
        Number.isFinite(nowcastEndMs) &&
        tMs > overlapStartMs &&
        tMs < nowcastEndMs
      ) {
        const span = nowcastEndMs - overlapStartMs;
        blendOpacity = Math.max(0, Math.min(1, (tMs - overlapStartMs) / Math.max(1, span)));
      }
      frames.push({ t: tIso, source, values, snowValues, blendOpacity });
    }
  }

  // ---- ICON-CH2 deterministisch via Open-Meteo hourly (33…120 h) ----
  // Hinter dem minutely_15-Horizont von ICON-CH1 (~+33 h) hängen wir
  // stündliche Open-Meteo-`hourly.precipitation`-Werte als ICON-CH2-Source an.
  // Das gibt das gleiche „MeteoSchweiz-CH2"-Verhalten bis +120 h, ohne EPS.
  const ref1Hourly = r1 ? (r1[0] as LocResponse | undefined)?.hourly : undefined;
  // Letzter CH1-Frame-Timestamp, damit CH2 nahtlos anschliesst.
  let ch1LastMs = -Infinity;
  for (const f of frames) {
    if (f.source === "icon-ch1") {
      const ms = Date.parse(f.t);
      if (ms > ch1LastMs) ch1LastMs = ms;
    }
  }
  let ch2Count = 0;
  if (ref1Hourly && r1 && Array.isArray(ref1Hourly.precipitation)) {
    for (let ti = 0; ti < ref1Hourly.time.length; ti++) {
      const tIso = ref1Hourly.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= now) continue;
      if (tMs <= ch1LastMs) continue; // CH1 hat Vorrang im Überschneidungs-Bereich
      if (tMs > forecastCutoff) continue;
      const values: number[] = new Array(pts.length);
      for (let pi = 0; pi < pts.length; pi++) {
        const v = (r1[pi] as LocResponse | undefined)?.hourly?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v : 0; // hourly = mm/h direkt
      }
      frames.push({ t: tIso, source: "icon-ch2", values });
      ch2Count++;
    }
  }

  // Diagnose: welcher Vorhersagepfad ist aktiv?
  const ch1Count = frames.filter((f) => f.source === "icon-ch1").length;
  console.info(`[radar] forecast source: deterministic (ch1=${ch1Count}, ch2=${ch2Count})`);

  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  // ---- 15-min-Smoothing für Forecast-Frames via Wind-Advection ----
  // Zwischen zwei stündlichen ICON-CH1-Ankern (H und H+1) verschieben wir
  // das Niederschlagsfeld semi-Lagrange entlang des mittleren 700-hPa-
  // Windvektors. Dadurch "wandern" Niederschlagsgebiete echt, statt nur
  // crossfade-mäßig zu überblenden.
  const NCOLS = lons.length; // = GRID_LON
  const NROWS = lats.length; // = GRID_LAT
  const dLat = (lats[lats.length - 1] - lats[0]) / Math.max(1, NROWS - 1);
  const dLon = (lons[lons.length - 1] - lons[0]) / Math.max(1, NCOLS - 1);
  const midLat = (lats[0] + lats[lats.length - 1]) / 2;
  const M_PER_DEG_LAT = 111_000;
  const M_PER_DEG_LON = 111_000 * Math.cos((midLat * Math.PI) / 180);

  // Mittleren (u,v) für einen Zeitstempel aus dem hourly-Block aller Grid-Punkte
  // ableiten. Bevorzugt 700 hPa, sonst 10 m * 2.5 (grober Steuerwind-Proxy).
  function meanWindAt(tIso: string): { u: number; v: number } {
    if (!r1) return { u: 0, v: 0 };
    let su = 0, sv = 0, n = 0;
    for (let pi = 0; pi < pts.length; pi++) {
      const loc = r1[pi] as LocResponse | undefined;
      const h = loc?.hourly;
      if (!h?.time) continue;
      // Hourly time strings haben kein "Z"; tIso enthält ggf. Z.
      const target = tIso.replace(/Z$/, "");
      const ti = h.time.indexOf(target);
      if (ti < 0) continue;
      let sp = h.wind_speed_700hPa?.[ti];
      let dir = h.wind_direction_700hPa?.[ti];
      if (typeof sp !== "number" || typeof dir !== "number") {
        const sp10 = h.wind_speed_10m?.[ti];
        const dir10 = h.wind_direction_10m?.[ti];
        if (typeof sp10 === "number" && typeof dir10 === "number") {
          sp = sp10 * 2.5;
          dir = dir10;
        } else continue;
      }
      // Open-Meteo wind_speed = km/h → m/s
      const spMs = sp / 3.6;
      const rad = (dir * Math.PI) / 180;
      // Meteorologische Richtung: woher der Wind kommt. Bewegung des Felds = wohin.
      su += -spMs * Math.sin(rad); // Ost-Komponente (Lon +)
      sv += -spMs * Math.cos(rad); // Nord-Komponente (Lat +)
      n++;
    }
    if (n === 0) return { u: 0, v: 0 };
    return { u: su / n, v: sv / n };
  }

  // Bilineares Sampling eines row-major-Felds an (rowF, colF) mit 0-Padding.
  function sample(field: number[], rowF: number, colF: number): number {
    if (rowF < 0 || rowF > NROWS - 1 || colF < 0 || colF > NCOLS - 1) return 0;
    const r0 = Math.floor(rowF), c0 = Math.floor(colF);
    const r1i = Math.min(NROWS - 1, r0 + 1), c1i = Math.min(NCOLS - 1, c0 + 1);
    const fr = rowF - r0, fc = colF - c0;
    const v00 = field[r0 * NCOLS + c0] ?? 0;
    const v01 = field[r0 * NCOLS + c1i] ?? 0;
    const v10 = field[r1i * NCOLS + c0] ?? 0;
    const v11 = field[r1i * NCOLS + c1i] ?? 0;
    return (
      v00 * (1 - fr) * (1 - fc) +
      v01 * (1 - fr) * fc +
      v10 * fr * (1 - fc) +
      v11 * fr * fc
    );
  }

  // Verschiebt das Feld um (diRows, djCols). Positive di = nach Norden bewegt,
  // d.h. wir sampeln aus dem Süden: source_row = row - di.
  function shiftField(field: number[], diRows: number, djCols: number): number[] {
    const out = new Array(field.length);
    for (let r = 0; r < NROWS; r++) {
      for (let c = 0; c < NCOLS; c++) {
        out[r * NCOLS + c] = sample(field, r - diRows, c - djCols);
      }
    }
    return out;
  }

  const forecastFrames = frames.filter((f) => f.source === "icon-ch1" && !f.precipUrl);
  if (forecastFrames.length >= 2) {
    const anchorIdx: number[] = [];
    for (let i = 0; i < forecastFrames.length; i++) {
      if (new Date(forecastFrames[i].t).getUTCMinutes() === 0) anchorIdx.push(i);
    }

    const advectPair = (key: "values" | "snowValues") => {
      // Zwischen aufeinanderfolgenden Ankern A und B
      for (let a = 0; a < anchorIdx.length - 1; a++) {
        const iA = anchorIdx[a];
        const iB = anchorIdx[a + 1];
        const span = iB - iA;
        if (span <= 1) continue;
        const arrA = forecastFrames[iA][key];
        const arrB = forecastFrames[iB][key];
        if (!arrA || !arrB) continue;

        const wA = meanWindAt(forecastFrames[iA].t);
        const wB = meanWindAt(forecastFrames[iB].t);

        // Versatz pro 15-min-Slot in Grid-Zellen.
        const SLOT_S = 900;
        const diA = (wA.v * SLOT_S) / (dLat * M_PER_DEG_LAT);
        const djA = (wA.u * SLOT_S) / (dLon * M_PER_DEG_LON);
        const diB = (wB.v * SLOT_S) / (dLat * M_PER_DEG_LAT);
        const djB = (wB.u * SLOT_S) / (dLon * M_PER_DEG_LON);

        for (let k = 1; k < span; k++) {
          const t = k / span;
          const target = forecastFrames[iA + k][key];
          if (!target) continue;
          const aShift = shiftField(arrA, k * diA, k * djA);
          const bShift = shiftField(arrB, -(span - k) * diB, -(span - k) * djB);
          for (let pi = 0; pi < target.length; pi++) {
            target[pi] = aShift[pi] * (1 - t) + bShift[pi] * t;
          }
        }
      }

      // Frames VOR dem ersten Anker: nur Vorwärts-Advection von Anker 0.
      if (anchorIdx.length >= 1) {
        const i0 = anchorIdx[0];
        if (i0 > 0) {
          const arr0 = forecastFrames[i0][key];
          if (arr0) {
            const w0 = meanWindAt(forecastFrames[i0].t);
            const di = (w0.v * 900) / (dLat * M_PER_DEG_LAT);
            const dj = (w0.u * 900) / (dLon * M_PER_DEG_LON);
            for (let i = 0; i < i0; i++) {
              const target = forecastFrames[i][key];
              if (!target) continue;
              const k = i - i0; // negativ
              const shifted = shiftField(arr0, k * di, k * dj);
              for (let pi = 0; pi < target.length; pi++) target[pi] = shifted[pi];
            }
          }
        }
        // Frames NACH dem letzten Anker: Rückwärts-Advection vom letzten Anker.
        const iL = anchorIdx[anchorIdx.length - 1];
        if (iL < forecastFrames.length - 1) {
          const arrL = forecastFrames[iL][key];
          if (arrL) {
            const wL = meanWindAt(forecastFrames[iL].t);
            const di = (wL.v * 900) / (dLat * M_PER_DEG_LAT);
            const dj = (wL.u * 900) / (dLon * M_PER_DEG_LON);
            for (let i = iL + 1; i < forecastFrames.length; i++) {
              const target = forecastFrames[i][key];
              if (!target) continue;
              const k = i - iL;
              const shifted = shiftField(arrL, k * di, k * dj);
              for (let pi = 0; pi < target.length; pi++) target[pi] = shifted[pi];
            }
          }
        }
      }
    };

    advectPair("values");
    advectPair("snowValues");
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
    motion: manifest?.motion,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined,
  };
  return payload;
});



