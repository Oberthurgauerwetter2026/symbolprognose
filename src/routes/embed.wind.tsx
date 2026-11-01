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
      { name: "description", content: "Windprognose (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:title", content: "Windprognose (Embed) · Oberthurgauer Wetter" },
      { property: "og:description", content: "Windprognose (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Windprognose (Embed) · Oberthurgauer Wetter" },
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
