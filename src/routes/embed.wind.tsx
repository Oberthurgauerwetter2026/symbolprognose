import { createFileRoute } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";

import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

export const Route = createFileRoute("/embed/wind")({
  loader: () => setEmbedCacheHeaders(),
  component: EmbedWind,
  head: () => ({
    meta: [
      { title: "Wind (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedWind() {
  const def = getMap("wind");
  return (
    <EmbedShell>
      <ComingSoonMap icon={def.icon} title={def.label} description={def.description} />
    </EmbedShell>
  );
}

  head: () => ({
    meta: [
      { title: "Wind (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
