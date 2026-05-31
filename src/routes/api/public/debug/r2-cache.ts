import { createFileRoute } from "@tanstack/react-router";
import { getOpenMeteoCache } from "@/lib/openmeteo-cache.server";

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
              generatedAt?: string;
              version?: string | null;
              ageSeconds?: number | null;
              frameCount?: number;
              withPrecip?: number;
              withHail?: number;
              latestPrecipTs?: string | null;
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
        if (base) {
          try {
            const trimmed = base.replace(/\/+$/, "");
            const url = `${trimmed.replace(/\/radar\/?$/i, "")}/radar/frames.json`;
            const res = await fetch(url, { cf: { cacheTtl: 5 } } as RequestInit);
            if (res.ok) {
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
              radar = {
                generatedAt: m.generatedAt,
                version: m.version ?? null,
                ageSeconds: m.generatedAt
                  ? Math.round((Date.now() - Date.parse(m.generatedAt)) / 1000)
                  : null,
                frameCount: frames.length,
                withPrecip: frames.filter((x) => x.precipUrl).length,
                withHail: frames.filter((x) => x.hailUrl).length,
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
            } else {
              radar = { error: `manifest fetch ${res.status}` };
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
