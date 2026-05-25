import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Blitze von Blitzortung.org.
 *
 * Daten werden alle 5 Minuten von einer GitHub-Action
 * (`scripts/ingest_lightning.py`) in R2 unter `lightning/strikes.json`
 * abgelegt. Diese Serverfunktion liest die Datei aus R2 und gibt nur
 * Strikes der letzten 30 Minuten zurück.
 */

export interface LightningStrike {
  t: string; // ISO UTC
  lat: number;
  lon: number;
}

export interface LightningPayload {
  generatedAt: string;
  windowMinutes: number;
  strikes: LightningStrike[];
}

interface R2File {
  generatedAt: string;
  windowMinutes: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  strikes: LightningStrike[];
}

function buildUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (/\/lightning\/strikes\.json$/i.test(trimmed)) return trimmed;
  // R2_PUBLIC_URL kann entweder die Bucket-Wurzel oder bereits auf /radar/frames.json zeigen.
  return `${trimmed.replace(/\/(radar\/frames\.json|radar\/?)$/i, "")}/lightning/strikes.json`;
}

export const getLightningStrikes = createServerFn({ method: "GET" }).handler(
  async (): Promise<LightningPayload> => {
    setResponseHeader("Cache-Control", "public, max-age=20, s-maxage=20");

    const base = process.env.R2_PUBLIC_URL;
    if (!base) {
      return { generatedAt: new Date().toISOString(), windowMinutes: 30, strikes: [] };
    }

    const url = buildUrl(base);
    try {
      const res = await fetch(url, { cf: { cacheTtl: 20 } as unknown as undefined } as RequestInit);
      if (!res.ok) {
        console.warn(`[lightning] fetch ${url} -> ${res.status}`);
        return { generatedAt: new Date().toISOString(), windowMinutes: 30, strikes: [] };
      }
      const json = (await res.json()) as R2File;
      const cutoff = Date.now() - 30 * 60_000;
      const strikes = (json.strikes ?? []).filter((s) => Date.parse(s.t) >= cutoff);
      return {
        generatedAt: json.generatedAt,
        windowMinutes: json.windowMinutes ?? 30,
        strikes,
      };
    } catch (e) {
      console.warn(`[lightning] fetch error: ${(e as Error).message}`);
      return { generatedAt: new Date().toISOString(), windowMinutes: 30, strikes: [] };
    }
  },
);
