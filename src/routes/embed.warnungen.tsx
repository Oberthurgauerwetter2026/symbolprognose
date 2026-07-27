import { createFileRoute } from "@tanstack/react-router";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { EmbedShell } from "@/components/embed-shell";
import { WarnMap } from "@/components/maps/warn-map";

export const Route = createFileRoute("/embed/warnungen")({
  ssr: false,
  loader: () => setEmbedCacheHeaders(),
  component: () => (
    <EmbedShell>
      <div className="p-2">
        <WarnMap bare />
      </div>
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Wetterwarnungen Oberthurgau (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
