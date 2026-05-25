import { createFileRoute } from "@tanstack/react-router";
import { getOpenMeteoCache } from "@/lib/openmeteo-cache.server";

/**
 * Debug-Endpoint: zeigt Meta-Infos zum R2-Open-Meteo-Cache.
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
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
