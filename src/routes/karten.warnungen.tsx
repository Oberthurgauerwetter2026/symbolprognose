import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WarnMap } from "@/components/maps/warn-map";
import { warningsQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/warnungen")({
  ssr: false,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(warningsQuery());
  },
  component: KartenWarnungenPage,
  head: () => ({
    meta: [
      { title: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { name: "description", content: getMap("warnungen").description },
      { property: "og:title", content: "Wetterwarnungen Oberthurgau · Warnkarte" },
      { property: "og:description", content: getMap("warnungen").description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oberthurgauer-wetter.lovable.app/karten/warnungen" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://oberthurgauer-wetter.lovable.app/karten/warnungen" },
      APP_MANIFEST_LINK,
    ],
  }),

});

function KartenWarnungenPage() {
  const def = getMap("warnungen");
  return (
    <DashboardLayout title={def.label}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="warnungen" />
        <WarnMap />
      </div>
    </DashboardLayout>
  );
}
