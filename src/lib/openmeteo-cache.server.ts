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
let symbolMemo: { at: number; data: OpenMeteoCachePayload } | null = null;
let mchLocalMemo: { at: number; data: MchLocalForecastPayload } | null = null;

export interface MchLocalForecastLocation {
  id: string;
  mchPointId: number;
  name?: string;
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  timezone?: string;
  hourly: {
    time: string[];
    weathercode: (number | null)[];
    weathercode_mch?: (number | null)[];
    temperature_2m: (number | null)[];
    precipitation: (number | null)[];
    precipitation_probability: (number | null)[];
    windspeed_10m: (number | null)[];
    windgusts_10m: (number | null)[];
    winddirection_10m: (number | null)[];
    snowfall: (number | null)[];
    sunshine_duration: (number | null)[];
    cloud_cover_low: (number | null)[];
    cloud_cover_mid: (number | null)[];
    cloud_cover_high: (number | null)[];
  };
  daily: {
    time: string[];
    weathercode: (number | null)[];
    weathercode_mch?: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

export interface MchLocalForecastPayload {
  version?: string;
  generatedAt: string;
  stacItemId?: string;
  stacItemDatetime?: string;
  locations: MchLocalForecastLocation[];
}

/**
 * Lädt mch/local_forecast.json — primäre Quelle der Symbol- und
 * Lokalprognose (MeteoSchweiz OGD `ch.meteoschweiz.ogd-local-forecasting`).
 */
export async function getMchLocalForecastCache(): Promise<MchLocalForecastPayload | null> {
  if (mchLocalMemo && Date.now() - mchLocalMemo.at < MEMO_TTL_MS) return mchLocalMemo.data;
  const base = r2BaseUrl();
  if (!base) {
    console.warn("[mch-local-forecast] R2_PUBLIC_URL not set");
    return null;
  }
  try {
    const res = await fetch(`${base}/mch/local_forecast.json`, {
      cf: { cacheTtl: 30, cacheEverything: true } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[mch-local-forecast] ${res.status} on ${base}/mch/local_forecast.json`);
      return null;
    }
    const data = (await res.json()) as MchLocalForecastPayload;
    if (!data?.locations?.length) return null;
    mchLocalMemo = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.warn(`[mch-local-forecast] fetch error: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Lädt NUR symbol.json (phaseA — Symbolprognose). Eigener Memo,
 * damit Konsumenten der Symbolprognose nicht zusätzlich forecast.json ziehen.
 */
export async function getSymbolCache(): Promise<OpenMeteoCachePayload | null> {
  if (symbolMemo && Date.now() - symbolMemo.at < MEMO_TTL_MS) return symbolMemo.data;
  const base = r2BaseUrl();
  if (!base) {
    console.warn("[openmeteo-cache] R2_PUBLIC_URL not set");
    return null;
  }
  const data = await fetchCacheUrl(`${base}/openmeteo/symbol.json`);
  if (!data) return null;
  symbolMemo = { at: Date.now(), data };
  return data;
}

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
  if (symbolCache) symbolMemo = { at: Date.now(), data: symbolCache };
  return merged;
}
