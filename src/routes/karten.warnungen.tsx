import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WarnMap } from "@/components/maps/warn-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("warnungen");

export const Route = createFileRoute("/karten/warnungen")({
  ssr: false,
  component: KartenWarnungenPage,
  head: () => ({
    meta: [
      { title: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { name: "description", content: def.description },
      { property: "og:title", content: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { property: "og:description", content: def.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function KartenWarnungenPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="warnungen" />
        <WarnMap />
      </div>
    </DashboardLayout>
  );
}
