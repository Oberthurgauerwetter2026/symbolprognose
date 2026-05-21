import { createFileRoute } from "@tanstack/react-router";
import { WeatherWidget } from "@/components/weather-widget";

type IndexSearch = { day?: number };

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    const raw = Number(search.day);
    const day =
      Number.isInteger(raw) && raw >= 0 && raw <= 6 ? raw : undefined;
    return { day };
  },
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
