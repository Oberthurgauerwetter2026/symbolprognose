import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";

const WindMapLazy = lazy(() =>
  import("@/components/maps/wind-map").then((m) => ({ default: m.WindMap })),
);

export const Route = createFileRoute("/embed/widget-wind")({
  component: EmbedWidgetWind,
  loader: () => setEmbedCacheHeaders(),
  head: () => ({
    meta: [
      { title: "Windprognose aktuell (Widget)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWidgetWind() {
  return (
    <EmbedShell fillViewport>
      <div className="flex min-h-0 flex-1 flex-col">
        <ClientOnly
          fallback={<div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />}
        >
          <Suspense
            fallback={<div className="h-full min-h-[280px] w-full animate-pulse rounded-lg bg-muted" />}
          >
            <WindMapLazy bare snapshot />
          </Suspense>
        </ClientOnly>
      </div>
    </EmbedShell>
  );
}
