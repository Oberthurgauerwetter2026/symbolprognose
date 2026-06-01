import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { EmbedShell } from "@/components/embed-shell";

import { RadarNoscript, type RadarNoscriptData } from "@/components/embeds/radar-noscript";

// RadarMap importiert Leaflet auf Modul-Ebene (window-Zugriff). Daher
// dynamisch + nur clientseitig laden, damit die Route SSR-fähig bleibt
// und der <noscript>-Fallback im initialen HTML landet.
const RadarMapLazy = lazy(() =>
  import("@/components/maps/radar-map").then((m) => ({ default: m.RadarMap })),
);

const EMPTY_NOSCRIPT: RadarNoscriptData = { precipNext: [], precipDaily: [] };

export const Route = createFileRoute("/embed/radar")({
  component: EmbedRadar,
  loader: () => {
    // Embeds sind für alle Besucher identisch -> aggressiv am Edge cachen.
    // Keine teuren Server-Fetches mehr im Loader: Radar-Daten holt der Client
    // per React Query parallel zum JS-Download. Spart ~3-4 s TTFB.
    setResponseHeaders(
      new Headers({
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      }),
    );
  },
  head: () => ({
    meta: [
      { title: "Radar (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRadar() {
  return (
    <>
      <noscript>
        <RadarNoscript data={EMPTY_NOSCRIPT} />
      </noscript>
      <EmbedShell fillViewport>
        <div className="flex min-h-0 flex-1 flex-col">
          <ClientOnly
            fallback={
              <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
            }
          >
            <Suspense
              fallback={
                <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
              }
            >
              <RadarMapLazy bare />
            </Suspense>
          </ClientOnly>
        </div>
      </EmbedShell>
    </>
  );
}
