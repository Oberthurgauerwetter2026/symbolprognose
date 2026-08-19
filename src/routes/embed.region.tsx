import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { EmbedShell } from "@/components/embed-shell";
import { WeatherWidget } from "@/components/weather-widget";
import { LazyRegionMap, preloadRegionMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { regionForecastQuery, warningsQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/region")({
  ssr: false,
  loader: ({ context }) => {
    // Karten-Chunk und Daten gleichzeitig starten, ohne das Rendern zu blockieren.
    preloadRegionMap();
    context.queryClient.prefetchQuery(regionForecastQuery());
    context.queryClient.prefetchQuery(warningsQuery());
  },
  component: EmbedRegion,
  head: () => ({
    meta: [
      { title: "Wetterkarte Region (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Spot = { name: string; lat: number; lon: number };

function EmbedRegion() {
  const [selected, setSelected] = useState<Spot | null>(null);

  return (
    <EmbedShell>
      {selected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Zurück zur Karte
            </button>
            <span className="truncate text-xs font-semibold text-muted-foreground">
              {selected.name}
            </span>
          </div>
          <WeatherWidget
            compact
            initialExtended
            lockedLocation={{
              name: selected.name,
              latitude: selected.lat,
              longitude: selected.lon,
            }}
          />
        </div>
      ) : (
        <div className="min-h-[480px]">
          <Suspense fallback={<MapSkeleton />}>
            <LazyRegionMap onSelectSpot={setSelected} />
          </Suspense>
        </div>
      )}

    </EmbedShell>
  );
}
