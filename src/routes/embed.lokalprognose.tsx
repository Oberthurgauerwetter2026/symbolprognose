import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedErrorBoundary } from "@/components/embed-error-boundary";
import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript } from "@/components/embeds/lokal-noscript";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { buildLokalNoscriptData } from "@/lib/embed-noscript.server";

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
  lat: fallback(z.number().optional(), undefined).optional(),
  lon: fallback(z.number().optional(), undefined).optional(),
  name: fallback(z.string().optional(), undefined).optional(),
});

export const Route = createFileRoute("/embed/lokalprognose")({
  component: EmbedLokalprognose,
  validateSearch: zodValidator(searchSchema),
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
      { title: "Lokalprognose (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedLokalprognose() {
  const { day, lat, lon, name } = Route.useSearch();
  const { noscript } = Route.useLoaderData();
  const initialLocation =
    lat != null && lon != null && name
      ? { name, latitude: lat, longitude: lon }
      : undefined;
  return (
    <>
      <div className="embed-fallback">
        <LokalNoscript data={noscript} />
      </div>
      <div className="embed-live">
        <EmbedErrorBoundary>
          <EmbedShell>
            <WeatherWidget initialDayIdx={day} initialLocation={initialLocation} />
          </EmbedShell>
        </EmbedErrorBoundary>
      </div>
    </>
  );
}
