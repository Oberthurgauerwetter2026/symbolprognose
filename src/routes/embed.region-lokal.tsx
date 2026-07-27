import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedErrorBoundary } from "@/components/embed-error-boundary";
import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript } from "@/components/embeds/lokal-noscript";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

export const Route = createFileRoute("/embed/region-lokal")({
  component: EmbedRegionLokal,
  loader: async () => {
    setEmbedCacheHeaders();
    const noscript = await buildLokalNoscriptData({
      name: "Amriswil",
      lat: 47.5469,
      lon: 9.2986,
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
      <div className="embed-fallback">
        <LokalNoscript data={noscript} />
      </div>
      <div className="embed-live">
        <EmbedErrorBoundary>
          <EmbedShell>
            <WeatherWidget detailOnly compact lockedLocation={{ name: "Amriswil", latitude: 47.5469, longitude: 9.2986 }} />
          </EmbedShell>
        </EmbedErrorBoundary>
      </div>
    </>
  );
}
