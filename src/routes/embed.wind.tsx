import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazyWindMap, preloadWindMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { windFramesQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/wind")({
  component: EmbedWind,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadWindMap();
      context.queryClient.prefetchQuery(windFramesQuery());
    }
  },
  head: () => ({
    meta: [
      { title: "Windprognose (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWind() {
  const fallback = <MapSkeleton />;
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazyWindMap bare />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
