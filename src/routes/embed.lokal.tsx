import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EmbedShell } from "@/components/embed-shell";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";

import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript, type LokalNoscriptData } from "@/components/embeds/lokal-noscript";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

const EMPTY_NOSCRIPT: LokalNoscriptData = {
  locationName: AMRISWIL.name,
  hourly: [],
  daily: [],
};

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

export const Route = createFileRoute("/embed/lokal")({
  component: EmbedLokal,
  validateSearch: zodValidator(searchSchema),
  loader: () => {
    setEmbedCacheHeaders();
    return { noscript: EMPTY_NOSCRIPT };
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
      <noscript>
        <LokalNoscript data={noscript} />
      </noscript>
      <EmbedShell>
        <WeatherWidget
          initialDayIdx={day}
          detailOnly
          compact
          lockedLocation={{ name: AMRISWIL.name, latitude: AMRISWIL.lat, longitude: AMRISWIL.lon }}
        />
      </EmbedShell>
    </>
  );
}
