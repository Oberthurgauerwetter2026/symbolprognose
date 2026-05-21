import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { WeatherWidget } from "@/components/weather-widget";

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "5-Tage Wetterprognose · ICON-CH2" },
      {
        name: "description",
        content:
          "5-Tage Wetterprognose im 3-Stunden-Takt mit Modelldaten von MeteoSchweiz (ICON-CH2). Embeddable Widget für WordPress.",
      },
    ],
  }),
});

function Index() {
  const { day } = Route.useSearch();
  return <WeatherWidget initialDayIdx={day} />;
}
