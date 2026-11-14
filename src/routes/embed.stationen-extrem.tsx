import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { getStationExtremes } from "@/lib/station-extremes.functions";
import { parseStat, rankExtremes } from "@/lib/station-extremes";

const ExtremesMap = lazy(() => import("@/components/maps/extremes-map").then((m) => ({ default: m.ExtremesMap })));
const q = () => queryOptions({ queryKey: ["station-extremes"], queryFn: () => getStationExtremes(), refetchInterval: 300_000, staleTime: 120_000 });

export const Route = createFileRoute("/embed/stationen-extrem")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ stat: parseStat(s.stat) }),
  component: Page,
  head: () => ({
    meta: [
      { title: "Tiefst- und Höchsttemperaturen heute · Oberthurgauer Wetter" },
      { name: "description", content: "Heutige Tiefst- und Höchsttemperaturen der eigenen Wetterstationen im Oberthurgau." },
      { property: "og:title", content: "Tiefst- und Höchsttemperaturen heute · Oberthurgauer Wetter" },
      { property: "og:description", content: "Heutige Tiefst- und Höchsttemperaturen der eigenen Wetterstationen im Oberthurgau." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const { stat } = Route.useSearch();
  const { data = [] } = useQuery(q());
  const ranked = rankExtremes(data, stat);
  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-muted">
      <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
        <ExtremesMap stations={ranked} stat={stat} />
      </Suspense>
      <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow backdrop-blur">
        {stat === "min" ? "Tiefsttemperatur heute" : "Höchsttemperatur heute"}
      </div>
      <div className="pointer-events-none absolute bottom-1 right-2 z-[500] text-[10px] text-muted-foreground">Oberthurgauer Wetter · Daten: eigene Stationen</div>
    </div>
  );
}
