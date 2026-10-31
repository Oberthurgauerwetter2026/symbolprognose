import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { PastSumsView } from "@/components/maps/past-sums-view";
import { preloadPrecipAccumMap } from "@/components/maps/lazy-maps";
import { pastPrecipQuery } from "@/lib/map-queries";

export const Route = createFileRoute("/embed/niederschlag")({
  ssr: false,
  loader: ({ context }) => {
    preloadPrecipAccumMap();
    context.queryClient.prefetchQuery(pastPrecipQuery());
  },
  component: () => (
    <EmbedShell>
      <PastSumsView embed />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Oberthurgauer Wetter · Niederschlagssummen-Einbettung" },
      { name: "description", content: "Gefallener Niederschlag und Neuschnee der letzten 12–72 Stunden zum Einbetten." },
      { property: "og:title", content: "Niederschlagssummen Oberthurgau (Einbettung)" },
      { property: "og:description", content: "Gefallene Summen der letzten 12–72 Stunden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
