import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WindMap } from "@/components/maps/wind-map";
import { windFramesQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/wind")({
  ssr: false,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(windFramesQuery());
  },
  component: KartenWindPage,
  head: () => ({
    meta: [
      { title: "Windprognose Oberthurgau · Animation" },
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
        <WindMap />
      </div>
    </DashboardLayout>
  );
}
