import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Radar-Frames für die Region Oberthurgau.
 *
 * Vergangenheit (≤ now):
 *   - Bevorzugt: echte MeteoSchweiz-CPC- / POH-PNGs aus Cloudflare R2
 *     (befüllt durch `scripts/ingest_radar.py` via GitHub Actions).
 *   - Fallback: Open-Meteo minutely_15.precipitation als interpoliertes
 *     Punkt-Grid (kein echtes Radar).
 *
 * Vorhersage (> now):
 *   - ICON-CH1 (+33h, 15-min Raster) via Open-Meteo Multi-Location-Grid
 *   - ICON-CH2 (+120h, 1-h Raster) via Open-Meteo
 */

// Bounding-Box passend zur Region (auch im Python-Ingest verwendet).
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
  const pts: { lat: number; lon: number }[] = [];
  for (const la of lats) for (const lo of lons) pts.push({ lat: la, lon: lo });
  return { lats, lons, pts };
}

export interface RadarFrame {
  t: string; // ISO UTC
  source: "radar" | "icon-ch1" | "icon-ch2";
  /** Niederschlag mm/h pro Grid-Punkt (row-major). Bei `imageUrl`-Frames leer. */
  values: number[];
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

async function fetchOpenMeteo(params: URLSearchParams): Promise<unknown[]> {
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [data];
}


type LocResponse = {
  minutely_15?: { time: string[]; precipitation: (number | null)[] };
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
  const latStr = pts.map((p) => p.lat.toFixed(4)).join(",");
  const lonStr = pts.map((p) => p.lon.toFixed(4)).join(",");

  // Phase 1: Open-Meteo Radar-Nowcast (-12h) + ICON-CH1 (+33h), 15-min.
  const p1 = new URLSearchParams();
  p1.set("latitude", latStr);
  p1.set("longitude", lonStr);
  p1.set("minutely_15", "precipitation");
  p1.set("past_minutely_15", String(48));
  p1.set("forecast_minutely_15", String(132));
  p1.set("timezone", "UTC");
  p1.set("models", "meteoswiss_icon_ch1");

  // Phase 2: ICON-CH2 stündlich für +33h ... +120h.
  const p2 = new URLSearchParams();
  p2.set("latitude", latStr);
  p2.set("longitude", lonStr);
  p2.set("hourly", "precipitation");
  p2.set("forecast_days", "6");
  p2.set("timezone", "UTC");
  p2.set("models", "meteoswiss_icon_ch2");

  const [r1Res, r2Res, manifestRes] = await Promise.allSettled([
    fetchOpenMeteo(p1),
    fetchOpenMeteo(p2),
    fetchR2Manifest(),
  ]);

  const r1 = r1Res.status === "fulfilled" ? r1Res.value : null;
  const r2 = r2Res.status === "fulfilled" ? r2Res.value : null;
  const manifest = manifestRes.status === "fulfilled" ? manifestRes.value : null;

  const warnings: string[] = [];
  if (r1Res.status === "rejected") {
    console.warn("[radar] phase1 failed:", (r1Res.reason as Error)?.message);
    warnings.push("Nowcast/ICON-CH1 temporär nicht verfügbar");
  }
  if (r2Res.status === "rejected") {
    console.warn("[radar] phase2 failed:", (r2Res.reason as Error)?.message);
    warnings.push("ICON-CH2 temporär nicht verfügbar");
  }

  const now = Date.now();
  const ch1Cutoff = now + 33 * 3600 * 1000;
  const frames: RadarFrame[] = [];

  // ---- Vergangenheit ----
  const hasRealRadar = !!manifest && manifest.frames.length > 0;
  const hasHail = hasRealRadar && manifest!.frames.some((f) => f.hailUrl);
  const imageBbox = manifest?.bbox ?? BBOX;

  if (hasRealRadar) {
    for (const mf of manifest!.frames) {
      const tMs = Date.parse(mf.t);
      if (tMs > now) continue;
      frames.push({
        t: mf.t,
        source: "radar",
        values: [],
        precipUrl: mf.precipUrl,
        hailUrl: mf.hailUrl,
      });
    }
  }

  // ---- Phase 1 (Open-Meteo): Fallback-Past + ICON-CH1-Future ----
  const ref1 = r1 ? (r1[0] as LocResponse | undefined)?.minutely_15 : undefined;
  if (ref1 && r1) {
    for (let ti = 0; ti < ref1.time.length; ti++) {
      const tIso = ref1.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= now && hasRealRadar) continue;
      const values: number[] = new Array(pts.length);
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r1[pi] as LocResponse | undefined;
        const v = loc?.minutely_15?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v * 4 : 0;
      }
      const source: RadarFrame["source"] = tMs <= now ? "radar" : "icon-ch1";
      frames.push({ t: tIso, source, values });
    }
  }

  // ---- Phase 2 (Open-Meteo): ICON-CH2 stündlich ab ch1Cutoff ----
  const ref2 = r2 ? (r2[0] as LocResponse | undefined)?.hourly : undefined;
  if (ref2 && r2) {
    for (let ti = 0; ti < ref2.time.length; ti++) {
      const tIso = ref2.time[ti] + "Z";
      const tMs = Date.parse(tIso);
      if (tMs <= ch1Cutoff) continue;
      const values: number[] = new Array(pts.length);
      for (let pi = 0; pi < pts.length; pi++) {
        const loc = r2[pi] as LocResponse | undefined;
        const v = loc?.hourly?.precipitation?.[ti];
        values[pi] = typeof v === "number" ? v : 0;
      }
      frames.push({ t: tIso, source: "icon-ch2", values });
    }
  }

  frames.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

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

