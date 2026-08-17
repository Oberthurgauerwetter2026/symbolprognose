import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";

const RadarMapLazy = lazy(() =>
  import("@/components/maps/radar-map").then((m) => ({ default: m.RadarMap })),
);

export const Route = createFileRoute("/embed/widget-radar")({
  component: EmbedWidgetRadar,
  loader: () => setEmbedCacheHeaders(),
  head: () => ({
    meta: [
      { title: "Radar aktuell (Widget)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWidgetRadar() {
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly
          fallback={<div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />}
        >
          <Suspense
            fallback={<div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />}
          >
            <RadarMapLazy bare snapshot />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
