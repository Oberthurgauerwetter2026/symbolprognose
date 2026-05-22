import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { RegionMap } from "@/components/region-map";

export const Route = createFileRoute("/karten/region")({
  ssr: false,
  component: KartenRegionPage,
  head: () => ({
    meta: [
      { title: "Wetterkarte Region · Symbolprognose" },
      {
        name: "description",
        content:
          "Interaktive Karte mit Symbolprognose, Temperatur und Wind für Horn, Amriswil, Sitterdorf und Münsterlingen.",
      },
      { property: "og:title", content: "Wetterkarte Region · Symbolprognose" },
      {
        property: "og:description",
        content:
          "Interaktive Karte mit aktueller Symbolprognose an vier Standorten der Region Oberthurgau.",
      },
    ],
  }),
});

function KartenRegionPage() {
  return (
    <DashboardLayout title="Wetterkarte Region" subtitle="Symbolprognose · aktualisiert jede Stunde">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="region" />
        <RegionMap />
      </div>
    </DashboardLayout>
  );
}
