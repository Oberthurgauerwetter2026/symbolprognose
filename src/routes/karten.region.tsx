import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazyRegionMap } from "@/components/maps/lazy-maps";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

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
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenRegionPage() {
  return (
    <DashboardLayout title="Wetterkarte Region" subtitle="Symbolprognose · aktualisiert jede Stunde">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="region" />
        <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
          <LazyRegionMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
