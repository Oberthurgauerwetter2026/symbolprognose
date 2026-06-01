import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";

const RegionMap = lazy(() =>
  import("@/components/region-map").then((module) => ({ default: module.RegionMap })),
);

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
        <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
          <RegionMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
