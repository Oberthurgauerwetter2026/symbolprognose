import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WarnMap } from "@/components/maps/warn-map";
import { getMap } from "@/lib/maps-config";

export const Route = createFileRoute("/karten/warnungen")({
  ssr: false,
  component: KartenWarnungenPage,
  head: () => ({
    meta: [
      { title: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { name: "description", content: getMap("warnungen").description },
      { property: "og:title", content: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { property: "og:description", content: getMap("warnungen").description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://warnkarte-oberthurgau.lovable.app/karten/warnungen" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://warnkarte-oberthurgau.lovable.app/karten/warnungen" },
    ],
  }),

});

function KartenWarnungenPage() {
  const def = getMap("warnungen");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="warnungen" />
        <WarnMap />
      </div>
    </DashboardLayout>
  );
}
