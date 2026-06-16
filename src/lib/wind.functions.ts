import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache } from "./openmeteo-cache.server";

/**
 * Windprognose-Frames für die Region Oberthurgau.
 * Quelle: ICON-CH1 hourly (`phase1`) für +0…+33 h, danach nahtlos
 * ICON-CH2 hourly (`phase2`) bis +48 h. Kein icon_seamless mehr — der
 * Übergang ist deterministisch auf den MeteoSchweiz-CH-Stack festgenagelt.
 *
 * Horizont: +0 … +48 h, stündlich. Keine Messdaten.
 */

const BBOX = { minLat: 46.85, maxLat: 48.30, minLon: 8.15, maxLon: 10.55 } as const;
const GRID_LON = 36;
const GRID_LAT = 22;
const FORECAST_HOURS = 48;

export interface WindFrame {
  /** ISO UTC */
  t: string;
  /** Böen 10 m, km/h, row-major (lat-major × lon) */
  gust: number[];
  /** Mittelwind 10 m, km/h */
  speed: number[];
  /** Richtung 10 m, ° meteorologisch (woher), 0..360 */
  dir: number[];
}

export interface WindPayload {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  gridLat: number[];
  gridLon: number[];
  frames: WindFrame[];
  generatedAt: string;
  warning?: string;
}

type LocHourly = {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
  };
};

function buildGrid() {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < GRID_LAT; i++) {
    lats.push(BBOX.minLat + ((BBOX.maxLat - BBOX.minLat) * i) / (GRID_LAT - 1));
  }
  for (let j = 0; j < GRID_LON; j++) {
    lons.push(BBOX.minLon + ((BBOX.maxLon - BBOX.minLon) * j) / (GRID_LON - 1));
  }
  return { lats, lons };
}

function gridFromPoints(points: { lat: number; lon: number }[] | undefined) {
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
  return { lats, lons };
}

/**
 * Baut für eine Phasen-Quelle (phase1 legacy / phase2 icon_seamless) einen
 * Index `tMs -> ti` über die ersten Location-Hourly-Times.
 */
function buildTimeIndex(arr: LocResponseArray | undefined): Map<number, number> {
  const idx = new Map<number, number>();
  const ref = (arr?.[0] as LocHourly | undefined)?.hourly;
  if (!ref?.time) return idx;
  for (let ti = 0; ti < ref.time.length; ti++) {
    const tIso = ref.time[ti];
    const tMs = Date.parse(tIso + (tIso.endsWith("Z") ? "" : "Z"));
    if (Number.isFinite(tMs)) idx.set(tMs, ti);
  }
  return idx;
}

/**
 * Liest Gust/Speed/Dir für (ti, allePunkte) aus einer Phasen-Quelle
 * (phase1 legacy / phase2 icon_seamless). Gibt `null` zurück, wenn alle
 * drei Felder leer/null sind — Caller fällt dann auf die nächste Quelle zurück.
 */
function readHour(
  arr: LocResponseArray,
  ti: number,
  nPts: number,
): { gust: number[]; speed: number[]; dir: number[] } | null {
  const gust = new Array<number>(nPts);
  const speed = new Array<number>(nPts);
  const dir = new Array<number>(nPts);
  let any = false;
  for (let pi = 0; pi < nPts; pi++) {
    const h = (arr[pi] as LocHourly)?.hourly;
    const g = h?.wind_gusts_10m?.[ti];
    const s = h?.wind_speed_10m?.[ti];
    const d = h?.wind_direction_10m?.[ti];
    if (typeof g === "number" || typeof s === "number" || typeof d === "number") any = true;
    gust[pi] = typeof g === "number" ? g : 0;
    speed[pi] = typeof s === "number" ? s : 0;
    dir[pi] = typeof d === "number" ? d : 0;
  }
  return any ? { gust, speed, dir } : null;
}

export const getWindFrames = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
  );

  const cache = await getOpenMeteoCache();
  const ch1 = (cache?.phase1 ?? cache?.phaseB) as LocResponseArray | undefined;
  const ch2 = cache?.phase2 as LocResponseArray | undefined;
  const cacheGrid = gridFromPoints(cache?.grid?.points);
  const { lats, lons } = cacheGrid ?? buildGrid();
  const nPts = lats.length * lons.length;

  const warnings: string[] = [];
  if (!cache) warnings.push("Open-Meteo-Cache temporär nicht verfügbar");

  const frames: WindFrame[] = [];

  const ch1Ok = Array.isArray(ch1) && ch1.length === nPts;
  const ch2Ok = Array.isArray(ch2) && ch2.length === nPts;
  const ch1Idx = ch1Ok ? buildTimeIndex(ch1) : new Map<number, number>();
  const ch2Idx = ch2Ok ? buildTimeIndex(ch2) : new Map<number, number>();

  if (ch1Ok || ch2Ok) {
    const now = Date.now();
    const startMs = Math.floor(now / 3600_000) * 3600_000;
    const cutoff = now + FORECAST_HOURS * 3600 * 1000;

    let ch1Used = 0;
    let ch2Used = 0;
    for (let tMs = startMs; tMs <= cutoff; tMs += 3600_000) {
      let hour: { gust: number[]; speed: number[]; dir: number[] } | null = null;
      if (ch1Ok) {
        const ti1 = ch1Idx.get(tMs);
        if (typeof ti1 === "number") {
          hour = readHour(ch1!, ti1, nPts);
          if (hour) ch1Used++;
        }
      }
      if (!hour && ch2Ok) {
        const ti2 = ch2Idx.get(tMs);
        if (typeof ti2 === "number") {
          hour = readHour(ch2!, ti2, nPts);
          if (hour) ch2Used++;
        }
      }
      if (!hour) continue;
      frames.push({ t: new Date(tMs).toISOString(), ...hour });
    }
    console.info(`[wind] CH1: ${ch1Used} h, CH2: ${ch2Used} h`);
  } else if (cache) {
    warnings.push("Open-Meteo-Cache enthält noch keine Windprognose; nach dem nächsten Ingest verfügbar");
  }

  const payload: WindPayload = {
    bbox: BBOX,
    gridLat: lats,
    gridLon: lons,
    frames,
    generatedAt: cache?.generatedAt ?? new Date().toISOString(),
  };
  if (warnings.length) payload.warning = warnings.join(" · ");
  return payload;
});

type LocResponseArray = unknown[];
