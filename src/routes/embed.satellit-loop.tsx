import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazySatelliteMap, preloadSatelliteMap } from "@/components/maps/lazy-maps";
import { satelliteManifestQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/satellit-loop")({
  component: EmbedSatellitLoop,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadSatelliteMap();
      context.queryClient.prefetchQuery(satelliteManifestQuery("alpen-ch"));
    }
  },
  head: () => ({
    meta: [
      { title: "Satellit Loop (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedSatellitLoop() {
  const fallback = (
    <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
  );
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazySatelliteMap bare loop lightningInitiallyActive />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
