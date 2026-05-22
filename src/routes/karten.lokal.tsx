import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { WeatherWidget } from "@/components/weather-widget";

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

export const Route = createFileRoute("/karten/lokal")({
  component: KartenLokalPage,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Lokalprognose · 5-Tage" },
      {
        name: "description",
        content:
          "5-Tage Lokalprognose im 3-Stunden-Takt mit Modelldaten von MeteoSchweiz (ICON-CH2).",
      },
    ],
  }),
});

function KartenLokalPage() {
  const { day } = Route.useSearch();
  return (
    <DashboardLayout title="Lokalprognose" subtitle="5-Tage-Prognose · ICON-CH1/CH2 · ECMWF IFS">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="lokal" />
        <WeatherWidget initialDayIdx={day} />
      </div>
    </DashboardLayout>
  );
}
