import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { RadarMap } from "@/components/maps/radar-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("radar");

export const Route = createFileRoute("/karten/radar")({
  ssr: false,
  component: KartenRadarPage,
  head: () => ({
    meta: [
      { title: "Radar Oberthurgau · Niederschlags-Animation" },
      { name: "description", content: def.description },
    ],
  }),
});

function KartenRadarPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="radar" />
        <RadarMap />
      </div>
    </DashboardLayout>
  );
}
