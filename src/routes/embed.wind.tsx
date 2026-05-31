import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedFallbackBar } from "@/components/embeds/embed-fallback-bar";
import { ComingSoonMap } from "@/components/maps/coming-soon-map";
import { getMap } from "@/lib/maps-config";

const def = getMap("wind");

export const Route = createFileRoute("/embed/wind")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <EmbedFallbackBar
        title={def.label}
        href="https://symbolprognose.lovable.app/karten/wind"
      />
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
