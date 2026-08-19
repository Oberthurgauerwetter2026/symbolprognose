import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { EmbedShell } from "@/components/embed-shell";
import { LazyWarnMap, preloadWarnMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { warningsQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/warnungen")({
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadWarnMap();
      context.queryClient.prefetchQuery(warningsQuery());
    }
  },
  component: EmbedWarnungen,

  head: () => ({
    meta: [
      { title: "Wetterwarnungen Oberthurgau (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWarnungen() {
  return (
    <EmbedShell>
      <ClientOnly fallback={<MapSkeleton />}>
        <Suspense fallback={<MapSkeleton />}>
          <LazyWarnMap bare />
        </Suspense>
      </ClientOnly>
    </EmbedShell>
  );
}
