import { Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { LazySatelliteMap, preloadSatelliteMap } from "@/components/maps/lazy-maps";
import { satelliteManifestQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/satellit")({
  component: EmbedSatellit,
  loader: ({ context }) => {
    setEmbedCacheHeaders();
    if (typeof document !== "undefined") {
      preloadSatelliteMap();
      context.queryClient.prefetchQuery(satelliteManifestQuery("alpen-ch"));
    }
  },
  head: () => ({
    meta: [
      { name: "description", content: "Satellit (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:title", content: "Satellit (Embed) · Oberthurgauer Wetter" },
      { property: "og:description", content: "Satellit (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Satellit (Embed) · Oberthurgauer Wetter" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedSatellit() {
  const fallback = (
    <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
  );
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazySatelliteMap bare />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
