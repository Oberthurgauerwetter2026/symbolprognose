import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedErrorBoundary } from "@/components/embed-error-boundary";
import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript } from "@/components/embeds/lokal-noscript";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

export const Route = createFileRoute("/embed/lokal-suche")({
  component: EmbedLokalSuche,
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
      { name: "description", content: "Lokalprognose mit Ortssuche (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:title", content: "Lokalprognose mit Ortssuche (Embed) · Oberthurgauer Wetter" },
      { property: "og:description", content: "Lokalprognose mit Ortssuche (Embed) für den Oberthurgau von Oberthurgauer Wetter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Lokalprognose mit Ortssuche (Embed) · Oberthurgauer Wetter" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedLokalSuche() {
  const { noscript } = Route.useLoaderData();
  return (
    <>
      <div className="embed-fallback">
        <LokalNoscript data={noscript} />
      </div>
      <div className="embed-live">
        <EmbedErrorBoundary>
          <EmbedShell>
            <WeatherWidget compact requireExplicitLocation />
          </EmbedShell>
        </EmbedErrorBoundary>
      </div>
    </>
  );
}
