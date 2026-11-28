import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { getStationExtremes } from "@/lib/station-extremes.functions";
import { parseStat, rankExtremes, zurichDay, STATION_STAT_LABELS } from "@/lib/station-extremes";
import { SourceFooter } from "@/components/source-footer";

const ExtremesMap = lazy(() => import("@/components/maps/extremes-map").then((m) => ({ default: m.ExtremesMap })));
const CACHE = "owt_station_readings_v2";
// Letzte Werte sofort aus dem Browser zeigen, frische Werte im Hintergrund nachladen.
const cached = () => { try {
  const v = JSON.parse(localStorage.getItem(CACHE) ?? "null");
  return v?.day === zurichDay(Date.now()) && Date.now() - v.at < 10 * 60_000 && Array.isArray(v.rows) && v.rows.length ? v.rows : undefined;
} catch { return undefined; } };
const q = () => queryOptions({
  queryKey: ["station-readings", zurichDay(Date.now())],
  queryFn: async () => { const d = await getStationExtremes(); try { if (d.length) localStorage.setItem(CACHE, JSON.stringify({ day: zurichDay(Date.now()), at: Date.now(), rows: d })); } catch { /* voll */ } return d; },
  placeholderData: cached, refetchInterval: 300_000, staleTime: 120_000,
});

export const Route = createFileRoute("/embed/stationen-extrem")({
  ssr: false,
  // region=1: Kartenbild der App (nur für die Kachel-Standbilder); bestehende Einbettungen ohne den Parameter bleiben unverändert.
  validateSearch: (s: Record<string, unknown>) => ({ stat: parseStat(s.stat), ...(s.region === 1 || s.region === "1" || s.region === true ? { region: true } : {}) }),
  component: Page,
  head: () => ({
    meta: [
      { title: "Stationskarten: Temperatur, Tagesböen und Regen · Oberthurgauer Wetter" },
      { name: "description", content: "Aktuelle Temperaturen, Tagesextreme, stärkste Windböen und Tagesniederschlag der neun regionalen Stationen im Oberthurgau." },
      { property: "og:title", content: "Stationskarten: Temperatur, Tagesböen und Regen · Oberthurgauer Wetter" },
      { property: "og:description", content: "Aktuelle Temperaturen, Tagesextreme, stärkste Windböen und Tagesniederschlag der neun regionalen Stationen im Oberthurgau." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const { stat, region } = Route.useSearch();
  const { data = [] } = useQuery(q());
  const ranked = rankExtremes(data, stat);
  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-muted">
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <ExtremesMap stations={ranked} stat={stat} regionStyle={region === true} />
        </Suspense>
        <div className="pointer-events-none absolute left-2 top-2 z-[500] rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow backdrop-blur">
          {STATION_STAT_LABELS[stat]}
        </div>
      </div>
      <SourceFooter data="eigene Stationen, MeteoSchweiz" className="m-0 shrink-0 px-2 py-1">
        {" · Karte: © "}<a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">swisstopo</a>
      </SourceFooter>
    </div>
  );
}
