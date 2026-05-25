/**
 * Worker liest Open-Meteo-Daten aus R2-Cache statt direkt von api.open-meteo.com.
 * Drop-in-Ersatz für direkte fetchOpenMeteo()-Aufrufe.
 *
 * ENV im Worker: R2_PUBLIC_URL (z.B. https://pub-xxx.r2.dev)
 */

export type CachedForecast = {
  version: string;
  generatedAt: string; // ISO UTC
  phase1: unknown[];
  phase2: unknown[];
};

export async function fetchOpenMeteoCache(): Promise<CachedForecast> {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error("R2_PUBLIC_URL missing");

  const url = `${base}/openmeteo/forecast.json`;
  const res = await fetch(url, {
    cf: { cacheTtl: 30, cacheEverything: true },
  } as RequestInit);

  if (!res.ok) throw new Error(`R2 cache HTTP ${res.status}`);
  return (await res.json()) as CachedForecast;
}

/** Optional: Fallback auf Live-Call, falls Cache zu alt. */
export async function fetchWithFallback(
  fallback: () => Promise<CachedForecast>,
  maxAgeSeconds = 600,
): Promise<CachedForecast> {
  try {
    const cached = await fetchOpenMeteoCache();
    const ageMs = Date.now() - new Date(cached.generatedAt).getTime();
    if (ageMs < maxAgeSeconds * 1000) return cached;
  } catch (err) {
    console.warn("cache read failed, falling back", err);
  }
  return fallback();
}
