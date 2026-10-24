import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazyRadarMap, preloadRadarMap } from "@/components/maps/lazy-maps";
import { radarFramesQuery } from "@/lib/map-queries";

import { RadarNoscript, type RadarNoscriptData } from "@/components/embeds/radar-noscript";

const EMPTY_NOSCRIPT: RadarNoscriptData = { precipNext: [], precipDaily: [] };

export const Route = createFileRoute("/embed/radar")({
  component: EmbedRadar,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    // Karten-Chunk und Radarframes parallel starten.
    if (typeof document !== "undefined") {
      preloadRadarMap();
      context.queryClient.prefetchQuery(radarFramesQuery());
    }
  },
  head: () => ({
    meta: [
      { title: "Oberthurgauer Wetter · Radar-Einbettung" },
      { name: "description", content: "Niederschlagsradar und Modellprognose für den Oberthurgau als eingebettete Wetterkarte." },
      { property: "og:title", content: "Oberthurgauer Wetter · Radar-Einbettung" },
      { property: "og:description", content: "Niederschlagsradar und Modellprognose für den Oberthurgau als eingebettete Wetterkarte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRadar() {
  const fallback = (
    <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
  );
  return (
    <>
      <noscript>
        <RadarNoscript data={EMPTY_NOSCRIPT} />
      </noscript>
      <EmbedShell fillViewport>
        <div className="flex min-h-0 flex-1 flex-col">
          <ClientOnly fallback={fallback}>
            <Suspense fallback={fallback}>
              <LazyRadarMap bare />
            </Suspense>
          </ClientOnly>
        </div>
      </EmbedShell>
    </>
  );
}
