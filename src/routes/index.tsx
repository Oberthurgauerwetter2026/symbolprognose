import { createFileRoute } from "@tanstack/react-router";
import { WeatherWidget } from "@/components/weather-widget";

export const Route = createFileRoute("/")({
  component: Index,
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
  return <WeatherWidget />;
}
