import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazySatelliteMap, preloadSatelliteMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { satelliteManifestQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/satellit")({
  ssr: false,
  loader: ({ context }) => {
    preloadSatelliteMap();
    context.queryClient.prefetchQuery(satelliteManifestQuery("alpen-ch"));
  },
  component: KartenSatellitPage,
  head: () => ({
    meta: [
      { title: "Satellitenbild Schweiz — Zeitraffer · letzte 5 Stunden" },
      { name: "description", content: getMap("satellit").description },
      { property: "og:title", content: "Satellitenbild Schweiz — Zeitraffer" },
      { property: "og:description", content: getMap("satellit").description },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenSatellitPage() {
  const def = getMap("satellit");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="satellit" />
        <Suspense fallback={<MapSkeleton height={720} />}>
          <LazySatelliteMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
