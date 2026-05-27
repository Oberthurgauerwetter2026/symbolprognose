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
  source: "radar" | "nowcast" | "icon-ch1" | "icon-ch2";
  /** Niederschlag mm/h pro Grid-Punkt (row-major). Bei `imageUrl`-Frames leer. */
  values: number[];
  /** Schnee-Wasser-Äquivalent mm/h pro Grid-Punkt (row-major). Leer = unbekannt. */
  snowValues?: number[];
  /** Wenn gesetzt, als ImageOverlay rendern statt Canvas (echte MCH-Daten). */
  precipUrl?: string;
  /** Optionaler Hagel-Overlay (POH %) URL. */
  hailUrl?: string;
  /** Nowcast: Verschiebung des PNG-Overlays gegenüber `imageBbox` in Grad. */
  imageOffset?: { dLat: number; dLon: number };
  /** Nur für `source==="nowcast"`: Herkunft des Bewegungsvektors. */
  motionSource?: "radar" | "wind";
}

export interface RadarMotion {
  u_ms: number;
  v_ms: number;
  u_deg_per_min: number;
  v_deg_per_min: number;
  sourceTs: string;
  confidence: number;
  pairs?: number;
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
    for (const mf of filled) {
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

  // ---- Nowcast (Radar-Extrapolation, T+0…+60 min) ----
  // Operationelles Verfahren wie MeteoSchweiz INCA / DWD RadVOR: das letzte
  // gemessene Radarbild wird entlang eines Bewegungsvektors verschoben. Im
  // Browser passiert das als reines ImageOverlay-Bounds-Shift — kein
  // Pixel-Resampling, kein Modell-Glättungs-Effekt.
  //
  // Primär: Vektor aus FFT-Phase-Korrelation der letzten 3 Radar-Frames
  // (im Manifest unter `motion`). Fallback: Steering-Wind aus ICON-CH1 (10 m
  // hochskaliert auf ~700 hPa-Niveau via Faktor 1.8), wenn Radar-Motion
  // fehlt oder degeneriert (≈ 0 m/s) ist.
  const motion = manifest?.motion;
  const MIN_CONF = 0.3;
  const MIN_RADAR_MS = 1.0; // < 1 m/s effektiv Stillstand → Fallback
  const NOWCAST_HORIZON_MIN = 60;
  const NOWCAST_STEP_MIN = 10;
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
            // Empirisch in dieser Bild-Pipeline: dir wird als „wohin der Wind
            // weht" behandelt (Vorzeichen NICHT invertieren), sonst zieht die
            // Niederschlagsverlagerung sichtbar rückwärts.
            const rad = (dirDeg * Math.PI) / 180;
            const uMs = speedMs * Math.sin(rad);
            const vMs = speedMs * Math.cos(rad);
            const mPerDegLat = 111_000;
            const mPerDegLon = 111_000 * Math.cos((midLat * Math.PI) / 180);
            nowcastMotion = {
              u_deg_per_min: (uMs * 60) / mPerDegLon,
              v_deg_per_min: (vMs * 60) / mPerDegLat,
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
      for (let m = NOWCAST_STEP_MIN; m <= NOWCAST_HORIZON_MIN; m += NOWCAST_STEP_MIN) {
        const tMs = lastMs + m * 60_000;
        if (tMs > forecastCutoff) break;
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
        });
      }
      nowcastEndMs = lastMs + NOWCAST_HORIZON_MIN * 60_000;
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
      // ICON-CH1-Frames innerhalb des Nowcast-Fensters unterdrücken
      if (tMs <= nowcastEndMs) continue;
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

  // ---- 15-min-Smoothing für Forecast-Frames via Wind-Advection ----
  // Zwischen zwei stündlichen ICON-CH1-Ankern (H und H+1) verschieben wir
  // das Niederschlagsfeld semi-Lagrange entlang des mittleren 700-hPa-
  // Windvektors. Dadurch "wandern" Niederschlagsgebiete echt, statt nur
  // crossfade-mäßig zu überblenden.
  const NCOLS = lons.length; // = GRID_LON
  const NROWS = lats.length; // = GRID_LAT
  const dLat = (BBOX.maxLat - BBOX.minLat) / Math.max(1, NROWS - 1);
  const dLon = (BBOX.maxLon - BBOX.minLon) / Math.max(1, NCOLS - 1);
  const midLat = (BBOX.maxLat + BBOX.minLat) / 2;
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

  const forecastFrames = frames.filter((f) => f.source === "icon-ch1");
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

