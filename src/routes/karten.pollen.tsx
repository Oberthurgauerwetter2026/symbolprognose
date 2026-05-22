import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("pollen");

export const Route = createFileRoute("/karten/pollen")({
  ssr: false,
  component: KartenPollenPage,
  head: () => ({
    meta: [
      { title: "Pollenprognose · in Vorbereitung" },
      { name: "description", content: def.description },
    ],
  }),
});

function KartenPollenPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="pollen" />
        <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
      </div>
    </DashboardLayout>
  );
}
