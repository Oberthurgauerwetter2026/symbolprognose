import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { RegionMap } from "@/components/region-map";
import { WeatherWidget } from "@/components/weather-widget";

const AMRISWIL = { name: "Amriswil", latitude: 47.5469, longitude: 9.2986 };

export const Route = createFileRoute("/embed/region-lokal")({
  ssr: false,
  component: EmbedRegionLokal,
  head: () => ({
    meta: [
      { title: "Wetterkarte + Lokalprognose Amriswil (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRegionLokal() {
  return (
    <EmbedShell fillViewport>
      <div className="@container flex h-full w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <RegionMap bare />
        </div>
        <div className="shrink-0">
          <WeatherWidget detailOnly compact lockedLocation={AMRISWIL} />
        </div>
      </div>
    </EmbedShell>
  );
}
