import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { EmbedShell } from "@/components/embed-shell";

const RegionMap = lazy(() =>
  import("@/components/region-map").then((module) => ({ default: module.RegionMap })),
);

export const Route = createFileRoute("/embed/region")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <Suspense fallback={<div className="h-[620px] rounded-lg bg-muted" />}>
        <RegionMap />
      </Suspense>
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Wetterkarte Region (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
