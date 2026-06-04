import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript } from "@/components/embeds/lokal-noscript";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

const AMRISWIL = { name: "Amriswil", latitude: 47.5469, longitude: 9.2986 };

export const Route = createFileRoute("/embed/region-lokal")({
  component: EmbedRegionLokal,
  loader: async () => {
    setEmbedCacheHeaders();
    const noscript = await buildLokalNoscriptData({
      name: AMRISWIL.name,
      lat: AMRISWIL.latitude,
      lon: AMRISWIL.longitude,
    });
    return { noscript };
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
