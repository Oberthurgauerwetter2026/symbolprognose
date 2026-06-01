import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";

import { RegionMap } from "@/components/region-map";

export const Route = createFileRoute("/embed/region")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <RegionMap />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Wetterkarte Region (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
