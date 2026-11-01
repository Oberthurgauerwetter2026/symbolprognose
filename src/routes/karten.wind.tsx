import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { Suspense } from "react";
import { LazyWindMap, preloadWindMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { windFramesQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/wind")({
  ssr: false,
  loader: ({ context }) => {
    preloadWindMap();
    context.queryClient.prefetchQuery(windFramesQuery());
  },
  component: KartenWindPage,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Windprognose Oberthurgau · Animation · Oberthurgauer Wetter" },
      { name: "description", content: getMap("wind").description },
      { property: "og:title", content: "Windprognose Oberthurgau · Animation" },
      { property: "og:description", content: getMap("wind").description },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenWindPage() {
  const def = getMap("wind");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="wind" />
        <Suspense fallback={<MapSkeleton />}>
          <LazyWindMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
