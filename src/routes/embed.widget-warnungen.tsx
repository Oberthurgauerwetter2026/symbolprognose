import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { EmbedShell } from "@/components/embed-shell";
import { LazyWarnMap, preloadWarnMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { warningsQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/widget-warnungen")({
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadWarnMap();
      context.queryClient.prefetchQuery(warningsQuery());
    }
  },
  component: EmbedWidgetWarnungen,
  head: () => ({
    meta: [
      { name: "description", content: "Warnungen aktuell (Widget) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:title", content: "Warnungen aktuell (Widget) · Oberthurgauer Wetter" },
      { property: "og:description", content: "Warnungen aktuell (Widget) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Warnungen aktuell (Widget) · Oberthurgauer Wetter" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWidgetWarnungen() {
  return (
    <EmbedShell>
      <ClientOnly fallback={<MapSkeleton height={320} />}>
        <Suspense fallback={<MapSkeleton height={320} />}>
          <LazyWarnMap bare snapshot />
        </Suspense>
      </ClientOnly>
    </EmbedShell>
  );
}
