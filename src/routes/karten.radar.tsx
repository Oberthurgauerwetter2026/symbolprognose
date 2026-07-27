import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { LazyRadarMap } from "@/components/maps/lazy-maps";
import { getMap } from "@/lib/maps-config";
import { getRadarFrames } from "@/lib/radar.functions";

export const Route = createFileRoute("/karten/radar")({
  ssr: false,
  loader: ({ context }) => {
    // Daten parallel zum Lazy-Chunk laden, ohne die Navigation zu blockieren.
    context.queryClient.prefetchQuery({
      queryKey: ["radar-frames"],
      queryFn: () => getRadarFrames(),
      staleTime: 5 * 60_000,
    });
  },
  component: KartenRadarPage,
  head: () => ({
    meta: [
      { title: "Niederschlagsradar Oberthurgau · Niederschlags-Animation" },
      { name: "description", content: getMap("radar").description },
    ],
  }),
});

function KartenRadarPage() {
  const def = getMap("radar");
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="radar" />
        <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
          <LazyRadarMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
