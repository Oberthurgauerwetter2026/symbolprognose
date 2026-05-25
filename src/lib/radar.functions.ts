import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Radar-Frames für die Region Oberthurgau.
 *
 * Quellen:
 *   - Vergangenheit (~-12h ... t=0): Open-Meteo minutely_15.precipitation
 *     (Radar-Nowcast Best-Match, indirekt MeteoSchweiz/DWD).
 *   - Vorhersage (t=0 ... +33h): ICON-CH1 via Open-Meteo (15-min Raster).
 *   - Vorhersage (+33h ... +120h): ICON-CH2 via Open-Meteo (1-h Raster).
 *
 * Wir holen das Grid mit einem einzigen Multi-Location-Call pro Phase.
 */

// Erweiterte Bounding-Box um die Region Oberthurgau (etwas Kontext drumherum).
const BBOX = { minLat: 47.38, maxLat: 47.72, minLon: 9.0, maxLon: 9.62 } as const;
const GRID_LON = 14;
const GRID_LAT = 9;

function buildGrid() {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < GRID_LAT; i++) {
    lats.push(BBOX.minLat + ((BBOX.maxLat - BBOX.minLat) * i) / (GRID_LAT - 1));
  }
  for (let j = 0; j < GRID_LON; j++) {
    lons.push(BBOX.minLon + ((BBOX.maxLon - BBOX.minLon) * j) / (GRID_LON - 1));
  }
  // Flatten zu Punkt-Liste (row-major, Süd→Nord, West→Ost).
  const pts: { lat: number; lon: number }[] = [];
  for (const la of lats) for (const lo of lons) pts.push({ lat: la, lon: lo });
  return { lats, lons, pts };
}

export interface RadarFrame {
  t: string; // ISO UTC
  source: "radar" | "icon-ch1" | "icon-ch2";
  /** Niederschlag mm/h pro Grid-Punkt, row-major (lat, lon). */
  values: number[];
}

export interface RadarPayload {
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  gridLat: number[];
  gridLon: number[];
  frames: RadarFrame[];
  generatedAt: string;
}

async function fetchOpenMeteo(params: URLSearchParams): Promise<unknown[]> {
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as unknown;
  // Multi-Location-Response ist ein Array; Single ist Objekt.
  return Array.isArray(data) ? data : [data];
}

type LocResponse = {
  minutely_15?: { time: string[]; precipitation: (number | null)[] };
  hourly?: { time: string[]; precipitation: (number | null)[] };
};

export const getRadarFrames = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "public, max-age=300, s-maxage=600");

  const { lats, lons, pts } = buildGrid();
  const latStr = pts.map((p) => p.lat.toFixed(4)).join(",");
  const lonStr = pts.map((p) => p.lon.toFixed(4)).join(",");

  // Phase 1: Radar-Nowcast (-12h) + ICON-CH1 (+33h) in 15-min Raster.
  const p1 = new URLSearchParams();
  p1.set("latitude", latStr);
  p1.set("longitude", lonStr);
  p1.set("minutely_15", "precipitation");
  p1.set("past_minutely_15", String(48)); // 12h * 4
  p1.set("forecast_minutely_15", String(132)); // 33h * 4
  p1.set("timezone", "UTC");
  p1.set("models", "meteoswiss_icon_ch1");

  // Phase 2: ICON-CH2 stündlich für +33h ... +120h.
  const p2 = new URLSearchParams();
  p2.set("latitude", latStr);
  p2.set("longitude", lonStr);
  p2.set("hourly", "precipitation");
  p2.set("forecast_days", "6");
  p2.set("timezone", "UTC");
  p2.set("models", "icon_ch2");

  const [r1, r2] = await Promise.all([fetchOpenMeteo(p1), fetchOpenMeteo(p2)]);

  const now = Date.now();
  const ch1Cutoff = now + 33 * 3600 * 1000;

  // Sammle Frames aus Phase 1 (minutely_15).
  const frames: RadarFrame[] = [];
  const ref1 = (r1[0] as LocResponse | undefined)?.minutely_15;
  if (ref1) {
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      const values: number[] = new Array(pts.length);
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const v = loc?.minutely_15?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v * 4 : 0; // 15-min sum -> mm/h
      }
      const source: RadarFrame["source"] = tMs <= now ? "radar" : "icon-ch1";
      frames.push({ t: tIso, source, values });
    }
  }

  // Phase 2: stündliche ICON-CH2 Frames, nur ab ch1Cutoff.
  const ref2 = (r2[0] as LocResponse | undefined)?.hourly;
  if (ref2) {
    for (let ti = 0; ti < ref2.time.length; ti++) {
      const tIso = ref2.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= ch1Cutoff) continue;
      const values: number[] = new Array(pts.length);
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r2[pi] as LocResponse | undefined;
        const v = loc?.hourly?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v : 0; // bereits mm/h
      }
      frames.push({ t: tIso, source: "icon-ch2", values });
    }
  }

  // Sortieren (sollte schon sortiert sein, sicherheitshalber).
  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  const payload: RadarPayload = {
    bbox: BBOX,
    gridLat: lats,
    gridLon: lons,
    frames,
    generatedAt: new Date().toISOString(),
  };
  return payload;
});
