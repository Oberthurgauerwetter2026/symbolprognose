import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { getStationExtremes } from "@/lib/station-extremes.functions";
import { parseStat, rankExtremes } from "@/lib/station-extremes";
import { SourceFooter } from "@/components/source-footer";

const ExtremesMap = lazy(() => import("@/components/maps/extremes-map").then((m) => ({ default: m.ExtremesMap })));
const q = () => queryOptions({ queryKey: ["station-extremes"], queryFn: () => getStationExtremes(), refetchInterval: 300_000, staleTime: 120_000 });

export const Route = createFileRoute("/embed/stationen-extrem")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ stat: parseStat(s.stat) }),
  component: Page,
  head: () => ({
    meta: [
      { title: "Tiefst- und Höchsttemperaturen heute · Oberthurgauer Wetter" },
      { name: "description", content: "Heutige Tiefst- und Höchsttemperaturen der eigenen Wetterstationen und der MeteoSchweiz-Stationen Sitterdorf-Bischofszell und Güttingen im Oberthurgau." },
      { property: "og:title", content: "Tiefst- und Höchsttemperaturen heute · Oberthurgauer Wetter" },
      { property: "og:description", content: "Heutige Tiefst- und Höchsttemperaturen der eigenen Wetterstationen und der MeteoSchweiz-Stationen Sitterdorf-Bischofszell und Güttingen im Oberthurgau." },
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
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-muted">
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <ExtremesMap stations={ranked} stat={stat} />
        </Suspense>
        <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow backdrop-blur">
          {stat === "min" ? "Tiefsttemperatur heute" : "Höchsttemperatur heute"}
        </div>
      </div>
      <SourceFooter data="eigene Stationen, MeteoSchweiz" className="m-0 shrink-0 px-2 py-1">
        {" · Karte: © "}<a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">swisstopo</a>
      </SourceFooter>
    </div>
  );
}
