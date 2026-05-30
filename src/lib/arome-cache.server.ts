/**
 * R2-Reader für das AROME-HD-Manifest (`arome/frames.json`).
 *
 * Wird konsumiert von src/lib/radar.functions.ts, wenn der UI-Toggle
 * `model="arome"` aktiv ist. Die Frames sind reine PNG-ImageOverlays —
 * keine Punkt-Werte. 60 s In-Memory-Cache.
 */

export interface AromeFrame {
  /** ISO UTC des Forecast-Zeitschritts (stündlich). */
  t: string;
  /** Public R2-URL des gerenderten RGBA-PNG. */
  url: string;
  /** Maximum mm/h im Original-Grid (für „dry hint" / Skip-Logik). */
  maxMmh: number;
}

export interface AromeManifest {
  version: string;
  generatedAt: string;
  imageBbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  grid: { lat: number; lon: number; outW: number; outH: number };
  frames: AromeFrame[];
}

let cache: { ts: number; data: AromeManifest | null } | null = null;
const TTL_MS = 60_000;

function r2Origin(): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return trimmed
    .replace(/\/radar\/frames\.json$/i, "")
    .replace(/\/radar\/?$/i, "");
}

export async function getAromeManifest(): Promise<AromeManifest | null> {
  const origin = r2Origin();
  if (!origin) {
    console.warn("[arome] R2_PUBLIC_URL not set");
    return null;
  }
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) return cache.data;

  const url = `${origin}/arome/frames.json`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30 } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[arome] manifest fetch ${url} -> ${res.status}`);
      cache = { ts: now, data: null };
      return null;
    }
    const json = (await res.json()) as AromeManifest;
    console.log(`[arome] manifest loaded: ${json.frames?.length ?? 0} frames`);
    cache = { ts: now, data: json };
    return json;
  } catch (e) {
    console.warn(`[arome] manifest fetch error: ${(e as Error).message}`);
    cache = { ts: now, data: null };
    return null;
  }
}
