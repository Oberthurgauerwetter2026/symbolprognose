import { createFileRoute } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";

import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("wind");

export const Route = createFileRoute("/embed/wind")({
  loader: () => setEmbedCacheHeaders(),
  component: () => (
    <EmbedShell>
      <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Wind (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
