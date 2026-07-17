import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { r2ObjectUrlCandidates } from "./r2-url.server";

/**
 * Blitz-Overlay für die Satellit-Karte.
 *
 * Datenquelle: Blitzortung.org (Community-Netz, bodenbasiert).
 * Ingest: `scripts/ingest_blitzortung.py` via GitHub-Actions-Cron.
 *
 * Datei liegt unter `lightning/latest.json` in R2:
 *   {
 *     generatedAt: ISO,
 *     bbox: { minLat, maxLat, minLon, maxLon },
 *     strikes: [{ t: ISO, lat, lon }, ...]  // letzte ~15 min
 *   }
 *
 * Fehlt die Datei, wird ein leerer Payload zurückgegeben, damit die UI
 * ohne Fehler weiterläuft.
 */

export interface LightningStrike {
  /** ISO UTC. */
  t: string;
  lat: number;
  lon: number;
}

export interface LightningPayload {
  generatedAt: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  strikes: LightningStrike[];
  attribution: string;
}

const EMPTY_BBOX = { minLat: 44, maxLat: 49, minLon: 5, maxLon: 12 } as const;

function emptyPayload(): LightningPayload {
  return {
    generatedAt: new Date().toISOString(),
    bbox: { ...EMPTY_BBOX },
    strikes: [],
    attribution: "Blitze: Blitzortung.org",
  };
}

async function fetchR2Lightning(): Promise<LightningPayload | null> {
  const candidates = [
    ...r2ObjectUrlCandidates(process.env.LIGHTNING_MANIFEST_URL, "lightning/latest.json"),
    ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, "lightning/latest.json"),
  ].filter((url, index, all) => all.indexOf(url) === index);

  if (candidates.length === 0) return null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        cf: { cacheTtl: 20 } as unknown as undefined,
      } as RequestInit);
      if (!res.ok) continue;
      const json = (await res.json()) as Partial<LightningPayload>;
      if (!Array.isArray(json?.strikes)) continue;
      const strikes = json.strikes.filter(
        (s): s is LightningStrike =>
          typeof s?.t === "string" &&
          Number.isFinite(s?.lat) &&
          Number.isFinite(s?.lon) &&
          !Number.isNaN(Date.parse(s.t)),
      );
      return {
        generatedAt: typeof json.generatedAt === "string" ? json.generatedAt : new Date().toISOString(),
        bbox: json.bbox ?? { ...EMPTY_BBOX },
        strikes,
        attribution: json.attribution ?? "Blitze: Blitzortung.org",
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export const getLightningStrikes = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "public, max-age=20, s-maxage=20");
  const payload = await fetchR2Lightning();
  return payload ?? emptyPayload();
});
