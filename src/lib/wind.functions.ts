import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache } from "./openmeteo-cache.server";

/**
 * Windprognose-Frames für die Region Oberthurgau.
 * Quelle: ICON-CH1 hourly (gleicher 36×22-Grid wie Radarprognose),
 * gelesen aus dem zentralen Open-Meteo-R2-Cache (`forecast.json`,
 * `phase1` / `phaseB`). Liefert Böen (km/h), Mittelwind (km/h)
 * und Richtung (° meteorologisch) für +0 … +24 h, stündlich.
 *
 * Keine Messdaten — bewusst reine Modellprognose.
 */

const BBOX = { minLat: 46.85, maxLat: 48.30, minLon: 8.15, maxLon: 10.55 } as const;
const GRID_LON = 36;
const GRID_LAT = 22;
const FORECAST_HOURS = 24;

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

export const getWindFrames = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
  );

  const cache = await getOpenMeteoCache();
  const cached = (cache?.phase1 ?? cache?.phaseB) as LocResponseArray | undefined;
  const cacheGrid = gridFromPoints(cache?.grid?.points);
  const { lats, lons } = cacheGrid ?? buildGrid();
  const nPts = lats.length * lons.length;

  const warnings: string[] = [];
  if (!cache) warnings.push("Open-Meteo-Cache temporär nicht verfügbar");

  const frames: WindFrame[] = [];

  if (Array.isArray(cached) && cached.length === nPts) {
    const ref = (cached[0] as LocHourly)?.hourly;
    if (ref?.time && Array.isArray(ref.time)) {
      const now = Date.now();
      const cutoff = now + FORECAST_HOURS * 3600 * 1000;
      // Erster Frame: aktuelle volle Stunde (floor).
      const startMs = Math.floor(now / 3600_000) * 3600_000;

      for (let ti = 0; ti < ref.time.length; ti++) {
        const tIso = ref.time[ti];
        const tMs = Date.parse(tIso + (tIso.endsWith("Z") ? "" : "Z"));
        if (tMs < startMs) continue;
        if (tMs > cutoff) break;

        const gust = new Array<number>(nPts);
        const speed = new Array<number>(nPts);
        const dir = new Array<number>(nPts);
        for (let pi = 0; pi < nPts; pi++) {
          const h = (cached[pi] as LocHourly)?.hourly;
          const g = h?.wind_gusts_10m?.[ti];
          const s = h?.wind_speed_10m?.[ti];
          const d = h?.wind_direction_10m?.[ti];
          gust[pi] = typeof g === "number" ? g : 0;
          speed[pi] = typeof s === "number" ? s : 0;
          dir[pi] = typeof d === "number" ? d : 0;
        }
        frames.push({ t: new Date(tMs).toISOString(), gust, speed, dir });
      }
    } else {
      warnings.push("Open-Meteo-Cache enthält keine Wind-Hourly-Daten (Cache muss neu erzeugt werden)");
    }
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
