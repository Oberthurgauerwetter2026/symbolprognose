import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";

const SatelliteMapLazy = lazy(() =>
  import("@/components/maps/satellite-map").then((m) => ({ default: m.SatelliteMap })),
);

export const Route = createFileRoute("/embed/satellit-loop")({
  component: EmbedSatellitLoop,
  loader: () => setEmbedCacheHeaders(),
  head: () => ({
    meta: [
      { title: "Satellit Loop (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedSatellitLoop() {
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly
          fallback={<div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />}
        >
          <Suspense
            fallback={<div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />}
          >
            <SatelliteMapLazy bare loop />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
