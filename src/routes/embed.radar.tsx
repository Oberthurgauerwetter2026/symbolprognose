import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { RadarMap } from "@/components/maps/radar-map";

export const Route = createFileRoute("/embed/radar")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <RadarMap bare />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Radar (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
