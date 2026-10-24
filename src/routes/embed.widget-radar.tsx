import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazyRadarMap, preloadRadarMap } from "@/components/maps/lazy-maps";
import { radarFramesQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/widget-radar")({
  component: EmbedWidgetRadar,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadRadarMap();
      context.queryClient.prefetchQuery(radarFramesQuery());
    }
  },
  head: () => ({
    meta: [
      { title: "Oberthurgauer Wetter · Aktuelles Radar-Widget" },
      { name: "description", content: "Die aktuelle Niederschlagsmessung im Oberthurgau als kompaktes Radar-Widget." },
      { property: "og:title", content: "Oberthurgauer Wetter · Aktuelles Radar-Widget" },
      { property: "og:description", content: "Die aktuelle Niederschlagsmessung im Oberthurgau als kompaktes Radar-Widget." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWidgetRadar() {
  const fallback = (
    <div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />
  );
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazyRadarMap bare snapshot />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
