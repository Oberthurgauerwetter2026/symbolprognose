import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EmbedShell } from "@/components/embed-shell";
import { WeatherWidget } from "@/components/weather-widget";

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

export const Route = createFileRoute("/embed/lokal")({
  component: EmbedLokal,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Lokalprognose (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedLokal() {
  const { day } = Route.useSearch();
  return (
    <EmbedShell>
      <WeatherWidget initialDayIdx={day} />
    </EmbedShell>
  );
}
