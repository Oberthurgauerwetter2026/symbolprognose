import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { getMap } from "@/lib/maps-config";

const def = getMap("satellit");
const SatelliteMap = lazy(() =>
  import("@/components/maps/satellite-map").then((m) => ({ default: m.SatelliteMap })),
);

export const Route = createFileRoute("/karten/satellit")({
  ssr: false,
  component: KartenSatellitPage,
  head: () => ({
    meta: [
      { title: "Satellitenbild Schweiz — Zeitraffer · letzte 5 Stunden" },
      { name: "description", content: def.description },
      { property: "og:title", content: "Satellitenbild Schweiz — Zeitraffer" },
      { property: "og:description", content: def.description },
    ],
  }),
});

function KartenSatellitPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="satellit" />
        <Suspense fallback={<div className="h-[720px] rounded-lg bg-muted" />}>
          <SatelliteMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
