import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazyWindMap, preloadWindMap } from "@/components/maps/lazy-maps";
import { windFramesQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/widget-wind")({
  component: EmbedWidgetWind,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadWindMap();
      context.queryClient.prefetchQuery(windFramesQuery());
    }
  },
  head: () => ({
    meta: [
      { title: "Windprognose aktuell (Widget)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWidgetWind() {
  const fallback = (
    <div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />
  );
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazyWindMap bare snapshot />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
