import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("radar");

export const Route = createFileRoute("/embed/radar")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Radar (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
