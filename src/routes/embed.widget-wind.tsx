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
      { name: "description", content: "Windprognose aktuell (Widget) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:title", content: "Windprognose aktuell (Widget) · Oberthurgauer Wetter" },
      { property: "og:description", content: "Windprognose aktuell (Widget) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Windprognose aktuell (Widget) · Oberthurgauer Wetter" },
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
