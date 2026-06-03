import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MapTabs } from "@/components/map-tabs";
import { getMap } from "@/lib/maps-config";
import { getRadarFrames } from "@/lib/radar.functions";

const def = getMap("radar");
const RadarMap = lazy(() =>
  import("@/components/maps/radar-map").then((module) => ({ default: module.RadarMap })),
);

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
      { title: "Radar Oberthurgau · Niederschlags-Animation" },
      { name: "description", content: def.description },
    ],
  }),
});


function KartenRadarPage() {
  return (
    <DashboardLayout title={def.label} subtitle={def.description}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <MapTabs active="radar" />
        <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
          <RadarMap />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
