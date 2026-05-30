/**
 * Zentraler R2-Read-Helper für den Open-Meteo-Cache.
 * Wird von radar.functions.ts und forecast.functions.ts verwendet.
 *
 * In-Memory-Memo: 30 s, damit innerhalb desselben Worker-Isolates
 * nicht jeder Request einen R2-Roundtrip macht. Edge-Cache (CF cacheTtl)
 * deckt die Cross-Isolate-Ebene ab.
 */

export interface OpenMeteoCachePayload {
  version?: string;
  generatedAt: string;
  grid?: { points: { lat: number; lon: number }[] };
  // Radar-Kompat
  phase1?: unknown[];
  phase2?: unknown[];
  // 3-Phasen-Schema
  phaseA?: unknown[];
  phaseB?: unknown[];
  phaseC?: unknown[];
}

const MEMO_TTL_MS = 30_000;
let memo: { at: number; data: OpenMeteoCachePayload } | null = null;

function r2BaseUrl(): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  try {
    // Bucket-Root: /radar/… und /openmeteo/… sind Geschwister unter Origin.
    return new URL(base).origin;
  } catch {
    return base.replace(/\/+$/, "").replace(/\/radar(\/.*)?$/i, "");
  }
}

async function fetchCacheUrl(url: string): Promise<OpenMeteoCachePayload | null> {
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30, cacheEverything: true } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[openmeteo-cache] ${url} -> ${res.status}`);
      return null;
    }
    return (await res.json()) as OpenMeteoCachePayload;
  } catch (e) {
    console.warn(`[openmeteo-cache] fetch error: ${(e as Error).message}`);
    return null;
  }
}

export async function getOpenMeteoCache(): Promise<OpenMeteoCachePayload | null> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.data;

  const base = r2BaseUrl();
  if (!base) {
    console.warn("[openmeteo-cache] R2_PUBLIC_URL not set");
    return null;
  }

  const [radarCache, symbolCache] = await Promise.all([
    fetchCacheUrl(`${base}/openmeteo/forecast.json`),
    fetchCacheUrl(`${base}/openmeteo/symbol.json`),
  ]);
  if (!radarCache && !symbolCache) return null;

  const merged: OpenMeteoCachePayload = {
    ...(radarCache ?? symbolCache!),
    phaseA: symbolCache?.phaseA?.length ? symbolCache.phaseA : radarCache?.phaseA,
  };
  memo = { at: Date.now(), data: merged };
  return merged;
}
