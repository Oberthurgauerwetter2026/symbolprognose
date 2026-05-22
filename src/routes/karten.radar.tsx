import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("radar");

export const Route = createFileRoute("/karten/radar")({
  ssr: false,
  component: KartenRadarPage,
  head: () => ({
    meta: [
      { title: "Radar · in Vorbereitung" },
      { name: "description", content: def.description },
    ],
  }),
});

function KartenRadarPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="radar" />
        <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
      </div>
    </DashboardLayout>
  );
}
