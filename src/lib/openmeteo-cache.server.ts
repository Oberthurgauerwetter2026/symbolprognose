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
  return base.replace(/\/+$/, "").replace(/\/radar\/?$/i, "");
}

export async function getOpenMeteoCache(): Promise<OpenMeteoCachePayload | null> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.data;

  const base = r2BaseUrl();
  if (!base) {
    console.warn("[openmeteo-cache] R2_PUBLIC_URL not set");
    return null;
  }
  const url = `${base}/openmeteo/forecast.json`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30, cacheEverything: true } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[openmeteo-cache] ${url} -> ${res.status}`);
      return null;
    }
    const json = (await res.json()) as OpenMeteoCachePayload;
    memo = { at: Date.now(), data: json };
    return json;
  } catch (e) {
    console.warn(`[openmeteo-cache] fetch error: ${(e as Error).message}`);
    return null;
  }
}
