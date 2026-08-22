import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmbedShell } from "@/components/embed-shell";

import { MAPS, type MapId } from "@/lib/maps-config";
import { WeatherWidget } from "@/components/weather-widget";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import {
  LazyPrecipAccumMap,
  LazyRadarMap,
  LazyRegionMap,
  LazySatelliteMap,
  LazyWarnMap,
  LazyWindMap,
  preloadMapChunk,
  preloadRegionMap,
} from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { radarAccumQuery, regionForecastQuery, warningsQuery } from "@/lib/map-queries";
import { cn } from "@/lib/utils";

const BRAND = "#2561a1";

export const Route = createFileRoute("/embed/all")({
  ssr: false,
  loader: ({ context }) => {
    preloadRegionMap();
    context.queryClient.prefetchQuery(regionForecastQuery());
    context.queryClient.prefetchQuery(warningsQuery());
  },
  component: EmbedAll,
  head: () => ({
    meta: [
      { title: "Wetter-Karten (Embed, alle)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedAll() {
  const [active, setActive] = useState<MapId>("region");

  return (
    <EmbedShell>
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {MAPS.filter((m) => !m.internal).map((m) => {
          const Icon = m.icon;
          const isActive = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m.id)}
              onMouseEnter={() => preloadMapChunk(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                isActive
                  ? "text-white shadow"
                  : "text-foreground hover:bg-foreground/5",
              )}
              style={isActive ? { background: BRAND } : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{m.shortLabel}</span>
              {m.status === "coming-soon" && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    isActive ? "bg-white/20 text-white" : "bg-background text-muted-foreground",
                  )}
                >
                  bald
                </span>
              )}
            </button>
          );
        })}
      </div>

      <MapPanel active={active} />
    </EmbedShell>
  );
}

/** Inhalt pro Tab — jede Live-Karte wird echt gerendert, nie leer. */
function MapPanel({ active }: { active: MapId }) {
  const def = MAPS.find((m) => m.id === active)!;
  const fallback = <MapSkeleton />;

  if (def.status === "coming-soon") {
    return (
      <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
    );
  }

  if (active === "lokal") return <WeatherWidget />;

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        {active === "region" && <LazyRegionMap />}
        {active === "warnungen" && <LazyWarnMap />}
        {active === "wind" && <LazyWindMap />}
        {active === "radar" && <LazyRadarMap />}
        {active === "satellit" && <LazySatelliteMap />}
        {active === "niederschlag" && <PrecipAccumPanel />}
      </Suspense>
    </ClientOnly>
  );
}

function PrecipAccumPanel() {
  const { data, isLoading, error } = useQuery({
    ...radarAccumQuery(),
    refetchInterval: 60 * 60_000,
  });

  if (isLoading) return <MapSkeleton />;
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Niederschlagssummen konnten nicht geladen werden: {(error as Error).message}
      </p>
    );
  }
  if (!data || data.frames.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Prognosedaten verfügbar.</p>;
  }

  return (
    <div className="space-y-6">
      {[12, 24, 48].map((h) => (
        <LazyPrecipAccumMap
          key={h}
          hours={h as 12 | 24 | 48}
          frames={data.frames}
          gridLat={data.gridLat}
          gridLon={data.gridLon}
        />
      ))}
    </div>
  );
}
