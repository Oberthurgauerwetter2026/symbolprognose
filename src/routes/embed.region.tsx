import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { EmbedFallbackBar } from "@/components/embeds/embed-fallback-bar";
import { RegionMap } from "@/components/region-map";

export const Route = createFileRoute("/embed/region")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <EmbedFallbackBar
        title="Wetterkarte Region"
        href="https://symbolprognose.lovable.app/karten/region"
      />
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
