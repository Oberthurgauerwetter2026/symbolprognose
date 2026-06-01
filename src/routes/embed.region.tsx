import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { EmbedShell } from "@/components/embed-shell";

import { RegionMap } from "@/components/region-map";

export const Route = createFileRoute("/embed/region")({
  ssr: false,
  loader: () => {
    setResponseHeaders(
      new Headers({
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      }),
    );
  },
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
