import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";

import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("pollen");

export const Route = createFileRoute("/embed/pollen")({
  
  component: () => (
    <EmbedShell>
      <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Pollen (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
