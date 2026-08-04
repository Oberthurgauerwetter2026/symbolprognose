import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazyRadarMap, preloadRadarMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { radarFramesQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/radar")({
  ssr: false,
  loader: ({ context }) => {
    // Daten parallel zum Lazy-Chunk laden, ohne die Navigation zu blockieren.
    preloadRadarMap();
    context.queryClient.prefetchQuery(radarFramesQuery());
  },
  component: KartenRadarPage,
  head: () => ({
    meta: [
      { title: "Niederschlagsradar Oberthurgau · Niederschlags-Animation" },
      { name: "description", content: getMap("radar").description },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenRadarPage() {
  const def = getMap("radar");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="radar" />
        <Suspense fallback={<MapSkeleton />}>
          <LazyRadarMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
