import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { WarnMap } from "@/components/maps/warn-map";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";

export const Route = createFileRoute("/embed/widget-warnungen")({
  ssr: false,
  loader: async () => {
    await setEmbedCacheHeaders();
  },
  component: () => (
    <EmbedShell>
      <WarnMap bare snapshot />
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Warnungen aktuell (Widget)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
