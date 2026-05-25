import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Blitze (KNMI / Météorage) aus R2.
 *
 * Befüllt durch `scripts/ingest_lightning.py` via GitHub Actions
 * alle 5 Minuten.
 */

export interface LightningStrike {
  t: string; // ISO UTC
  lat: number;
  lon: number;
}

export interface LightningPayload {
  generatedAt: string;
  windowMinutes: number;
  source: string;
  strikes: LightningStrike[];
}

interface R2File {
  generatedAt: string;
  windowMinutes: number;
  source?: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  strikes: LightningStrike[];
}

function buildUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (/\/lightning\/strikes\.json$/i.test(trimmed)) return trimmed;
  return `${trimmed.replace(/\/(radar\/frames\.json|radar\/?)$/i, "")}/lightning/strikes.json`;
}

export const getLightningStrikes = createServerFn({ method: "GET" }).handler(
  async (): Promise<LightningPayload> => {
    setResponseHeader("Cache-Control", "public, max-age=20, s-maxage=20");

    const base = process.env.R2_PUBLIC_URL;
    if (!base) {
      return {
        generatedAt: new Date().toISOString(),
        windowMinutes: 30,
        source: "KNMI / Météorage",
        strikes: [],
      };
    }

    const url = buildUrl(base);
    try {
      const res = await fetch(url, { cf: { cacheTtl: 20 } as unknown as undefined } as RequestInit);
      if (!res.ok) {
        console.warn(`[lightning] fetch ${url} -> ${res.status}`);
        return {
          generatedAt: new Date().toISOString(),
          windowMinutes: 30,
          source: "KNMI / Météorage",
          strikes: [],
        };
      }
      const json = (await res.json()) as R2File;
      const cutoff = Date.now() - 30 * 60_000;
      const strikes = (json.strikes ?? []).filter((s) => Date.parse(s.t) >= cutoff);
      return {
        generatedAt: json.generatedAt,
        windowMinutes: json.windowMinutes ?? 30,
        source: json.source ?? "KNMI / Météorage",
        strikes,
      };
    } catch (e) {
      console.warn(`[lightning] fetch error: ${(e as Error).message}`);
      return {
        generatedAt: new Date().toISOString(),
        windowMinutes: 30,
        source: "KNMI / Météorage",
        strikes: [],
      };
    }
  },
);
