import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedErrorBoundary } from "@/components/embed-error-boundary";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript } from "@/components/embeds/lokal-noscript";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

export const Route = createFileRoute("/embed/lokal")({
  component: EmbedLokal,
  validateSearch: zodValidator(searchSchema),
  loader: async () => {
    setEmbedCacheHeaders();
    const noscript = await buildLokalNoscriptData({
      name: AMRISWIL.name,
      lat: AMRISWIL.lat,
      lon: AMRISWIL.lon,
    });
    return { noscript };
  },
  head: () => ({
    meta: [
      { title: "Lokalprognose (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedLokal() {
  const { day } = Route.useSearch();
  const { noscript } = Route.useLoaderData();
  return (
    <>
      <div className="embed-fallback">
        <LokalNoscript data={noscript} />
      </div>
      <div className="embed-live">
        <EmbedErrorBoundary>
          <EmbedShell>
            <WeatherWidget
              initialDayIdx={day}
              detailOnly
              compact
              lockedLocation={{ name: AMRISWIL.name, latitude: AMRISWIL.lat, longitude: AMRISWIL.lon }}
            />
          </EmbedShell>
        </EmbedErrorBoundary>
      </div>
    </>
  );
}
