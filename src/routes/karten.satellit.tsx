import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazySatelliteMap } from "@/components/maps/lazy-maps";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/satellit")({
  ssr: false,
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
        <Suspense fallback={<div className="h-[720px] rounded-lg bg-muted" />}>
          <LazySatelliteMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
