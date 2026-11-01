import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { preloadPrecipAccumMap } from "@/components/maps/lazy-maps";
import { PastSumsView } from "@/components/maps/past-sums-view";
import { pastPrecipQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/niederschlag")({
  ssr: false,
  loader: ({ context }) => {
    preloadPrecipAccumMap();
    context.queryClient.prefetchQuery(pastPrecipQuery());
  },
  component: KartenNiederschlagPage,
  head: () => ({
    meta: [
      { title: "Gefallene Niederschlags- und Neuschneesummen Oberthurgau" },
      { name: "description", content: "Gefallener Niederschlag und Neuschnee im Oberthurgau der letzten 12, 24, 48 und 72 Stunden als Farbkarte." },
      { property: "og:title", content: "Niederschlags- und Neuschneesummen Oberthurgau" },
      { property: "og:description", content: "Gefallene Summen der letzten 12 bis 72 Stunden als Farbkarte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenNiederschlagPage() {
  const def = getMap("niederschlag");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="niederschlag" />
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Gefallene Summen der letzten 12, 24, 48 oder 72 Stunden. Die Fläche stammt aus Radar und Messstationen (CombiPrecip). Die Zahlen sind Messwerte: von MeteoSchweiz und eigenen Stationen (Name beim Darüberfahren). Neuschnee wird pro Fläche aus Niederschlag und Temperatur berechnet.
        </p>
        <PastSumsView />
      </div>
    </DashboardLayout>
  );
}

