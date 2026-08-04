import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazyPrecipAccumMap, preloadPrecipAccumMap } from "@/components/maps/lazy-maps";
import { MapSkeleton } from "@/components/maps/map-skeleton";
import { radarAccumQuery } from "@/lib/map-queries";
import { getMap } from "@/lib/maps-config";
import { APP_MANIFEST_LINK } from "@/lib/pwa-links";

export const Route = createFileRoute("/karten/niederschlag")({
  ssr: false,
  loader: ({ context }) => {
    preloadPrecipAccumMap();
    context.queryClient.prefetchQuery(radarAccumQuery());
  },
  component: KartenNiederschlagPage,
  head: () => ({
    meta: [
      { title: "Niederschlagssummen Oberthurgau · 12 / 24 / 48 h" },
      { name: "description", content: getMap("niederschlag").description },
    ],
    links: [APP_MANIFEST_LINK],
  }),
});

function KartenNiederschlagPage() {
  const def = getMap("niederschlag");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="niederschlag" />
        <PrecipDashboard />
      </div>
    </DashboardLayout>
  );
}

function PrecipDashboard() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    ...radarAccumQuery(),
    refetchInterval: 60 * 60_000,
  });

  const updatedAgo = dataUpdatedAt
    ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
        {updatedAgo !== null && (
          <span className="text-zinc-400 normal-case tracking-normal">
            · aktualisiert vor {updatedAgo} min
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-600 max-w-2xl">
        Akkumulierte Vorhersage für die nächsten 12, 24 und 48 Stunden auf Basis von
        ICON-seamless (CH1 1 km · CH2 2 km · ICON-EU/global 6–13 km, bis +168 h) via Open-Meteo.
        Auto-Refresh stündlich.
      </p>

      {isLoading && <div className="text-sm text-zinc-500">Lade Prognosedaten …</div>}
      {error && (
        <div className="text-sm text-red-600">
          Fehler beim Laden: {(error as Error).message}
        </div>
      )}

      {data && data.frames.length > 0 && (
        <div className="space-y-6">
          {[12, 24, 48].map((h) => (
            <Suspense key={h} fallback={<div className="h-[420px] rounded-lg bg-zinc-200" />}>
              <LazyPrecipAccumMap
                hours={h as 12 | 24 | 48}
                frames={data.frames}
                gridLat={data.gridLat}
                gridLon={data.gridLon}
              />
            </Suspense>
          ))}
        </div>
      )}

      {data && (
        <p className="text-xs text-zinc-400">
          Modell-Run generiert: {new Date(data.generatedAt).toLocaleString("de-CH")} ·{" "}
          {data.frames.length} Frames im Cache
        </p>
      )}
    </div>
  );
}
