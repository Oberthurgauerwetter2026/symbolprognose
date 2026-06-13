import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WindMap } from "@/components/maps/wind-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("wind");

export const Route = createFileRoute("/karten/wind")({
  ssr: false,
  component: KartenWindPage,
  head: () => ({
    meta: [
      { title: "Windprognose Oberthurgau · Animation" },
      { name: "description", content: def.description },
      { property: "og:title", content: "Windprognose Oberthurgau · Animation" },
      { property: "og:description", content: def.description },
    ],
  }),
});

function KartenWindPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="wind" />
        <WindMap />
      </div>
    </DashboardLayout>
  );
}
