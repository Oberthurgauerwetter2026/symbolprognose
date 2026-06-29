import { createFileRoute } from "@tanstack/react-router";
import { getOpenMeteoCache } from "@/lib/openmeteo-cache.server";
import { r2ObjectUrlCandidates } from "@/lib/r2-url.server";

/**
 * Debug-Endpoint: zeigt Meta-Infos zum R2-Open-Meteo-Cache + Radar-Manifest.
 * Aufruf: /api/public/debug/r2-cache
 */
export const Route = createFileRoute("/api/public/debug/r2-cache")({
  server: {
    handlers: {
      GET: async () => {
        const base = process.env.R2_PUBLIC_URL ?? null;
        const cache = await getOpenMeteoCache();
        const ageSec = cache?.generatedAt
          ? Math.round((Date.now() - Date.parse(cache.generatedAt)) / 1000)
          : null;

        // Radar-Manifest spiegeln, damit motion.field-Status sofort sichtbar ist.
        let radar:
          | {
              manifestUrl?: string;
              generatedAt?: string;
              version?: string | null;
              ageSeconds?: number | null;
              frameCount?: number;
              withPrecip?: number;
              withHail?: number;
              latestPrecipTs?: string | null;
              latestPrecipUrl?: string | null;
              latestPrecipAgeMin?: number | null;
              motionKeys?: string[];
              motionEmpty?: unknown;
              field?: {
                rows: number;
                cols: number;
                tiles: number;
                validTiles: number;
                hasGrowth: boolean;
                windPriorUsed?: unknown;
              } | null;
              error?: string;
            }
          | null = null;
        const manifestUrls = [
          ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, "radar/frames.json"),
          ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, "radar/frames.json"),
          ...r2ObjectUrlCandidates(base, "radar/frames.json"),
        ].filter((url, index, all) => all.indexOf(url) === index);

        if (manifestUrls.length > 0) {
          try {
            let lastError: string | null = null;
            for (const url of manifestUrls) {
              const res = await fetch(url, { cf: { cacheTtl: 5 } } as RequestInit);
              if (!res.ok) {
                lastError = `manifest fetch ${url} -> ${res.status}`;
                continue;
              }
              const m = (await res.json()) as {
                generatedAt?: string;
                version?: string;
                frames?: Array<{ t?: string; precipUrl?: string; hailUrl?: string }>;
                motion?: Record<string, unknown> & {
                  field?: {
                    rows?: number;
                    cols?: number;
                    conf?: number[];
                    growth_per_min?: number[];
                    wind_prior_used?: unknown;
                  };
                };
              };
              const frames = m.frames ?? [];
              const f = m.motion?.field;
              const conf = f?.conf ?? [];
              const precipFrames = frames.filter((x) => x.precipUrl && x.t);
              const latestPrecip = precipFrames[precipFrames.length - 1]?.t ?? null;
              const latestPrecipUrl = precipFrames[precipFrames.length - 1]?.precipUrl ?? null;
              radar = {
                manifestUrl: url,
                generatedAt: m.generatedAt,
                version: m.version ?? null,
                ageSeconds: m.generatedAt
                  ? Math.round((Date.now() - Date.parse(m.generatedAt)) / 1000)
                  : null,
                frameCount: frames.length,
                withPrecip: precipFrames.length,
                withHail: frames.filter((x) => x.hailUrl).length,
                latestPrecipTs: latestPrecip,
                latestPrecipUrl,
                latestPrecipAgeMin: latestPrecip
                  ? Math.round((Date.now() - Date.parse(latestPrecip)) / 60000)
                  : null,
                motionKeys: Object.keys(m.motion ?? {}),
                motionEmpty: (m.motion as { _empty?: unknown } | undefined)?._empty,
                field: f
                  ? {
                      rows: f.rows ?? 0,
                      cols: f.cols ?? 0,
                      tiles: conf.length,
                      validTiles: conf.filter((c) => c > 0.15).length,
                      hasGrowth: (f.growth_per_min?.length ?? 0) > 0,
                      windPriorUsed: f.wind_prior_used,
                    }
                  : null,
              };
              break;
            }
            if (!radar && lastError) {
              radar = { error: lastError };
            }
          } catch (e) {
            radar = { error: (e as Error).message };
          }
        }

        return Response.json(
          {
            r2PublicUrl: base,
            hasCache: !!cache,
            version: cache?.version ?? null,
            generatedAt: cache?.generatedAt ?? null,
            ageSeconds: ageSec,
            counts: {
              phase1: cache?.phase1?.length ?? 0,
              phase2: cache?.phase2?.length ?? 0,
              phaseA: cache?.phaseA?.length ?? 0,
              phaseB: cache?.phaseB?.length ?? 0,
              phaseC: cache?.phaseC?.length ?? 0,
            },
            gridPoints: cache?.grid?.points?.length ?? null,
            radar,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
