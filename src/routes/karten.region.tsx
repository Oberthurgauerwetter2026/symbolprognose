import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazyRegionMap, preloadRegionMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { regionForecastQuery, warningsQuery } from "@/lib/map-queries";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/region")({
  ssr: false,
  loader: ({ context }) => {
    // Chunk und Daten gleichzeitig starten (kein Wasserfall).
    preloadRegionMap();
    context.queryClient.prefetchQuery(regionForecastQuery());
    context.queryClient.prefetchQuery(warningsQuery());
  },
  component: KartenRegionPage,
  head: () => ({
    meta: [
      { title: "Wetterkarte Region · Symbolprognose" },
      {
        name: "description",
        content:
          "Interaktive Karte mit Symbolprognose, Temperatur und Wind für Horn, Amriswil, Sitterdorf und Münsterlingen.",
      },
      { property: "og:title", content: "Wetterkarte Region · Symbolprognose" },
      {
        property: "og:description",
        content:
          "Interaktive Karte mit aktueller Symbolprognose an vier Standorten der Region Oberthurgau.",
      },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenRegionPage() {
  return (
    <DashboardLayout title="Wetterkarte Region" subtitle="Symbolprognose · aktualisiert jede Stunde">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="region" />
        <Suspense fallback={<MapSkeleton />}>
          <LazyRegionMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
