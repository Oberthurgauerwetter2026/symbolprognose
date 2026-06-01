import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript, type LokalNoscriptData } from "@/components/embeds/lokal-noscript";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";

const AMRISWIL = { name: "Amriswil", latitude: 47.5469, longitude: 9.2986 };

const EMPTY_NOSCRIPT: LokalNoscriptData = {
  locationName: AMRISWIL.name,
  hourly: [],
  daily: [],
};

export const Route = createFileRoute("/embed/region-lokal")({
  component: EmbedRegionLokal,
  loader: () => {
    setEmbedCacheHeaders();
    return { noscript: EMPTY_NOSCRIPT };
  },
  head: () => ({
    meta: [
      { title: "Lokalprognose Amriswil (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRegionLokal() {
  const { noscript } = Route.useLoaderData();
  return (
    <>
      <noscript>
        <LokalNoscript data={noscript} />
      </noscript>
      <EmbedShell>
        <WeatherWidget detailOnly compact lockedLocation={AMRISWIL} />
      </EmbedShell>
    </>
  );
}
