import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { EmbedShell } from "@/components/embed-shell";
import { TickerBanner, TickerWidget } from "@/components/ticker/ticker-view";
import { listTickerPosts } from "@/lib/ticker.functions";
import { visiblePosts } from "@/lib/ticker";

export const tickerQuery = () =>
  queryOptions({ queryKey: ["ticker"], queryFn: () => listTickerPosts(), refetchInterval: 60_000, staleTime: 30_000 });

export const Route = createFileRoute("/embed/ticker")({
  validateSearch: (s: Record<string, unknown>) => ({ view: s.view === "banner" ? ("banner" as const) : ("widget" as const) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tickerQuery()),
  component: EmbedTicker,
  head: () => ({
    meta: [
      { title: "Wetter-Ticker · Oberthurgauer Wetter" },
      { name: "description", content: "Aktuelle Kurzmeldungen zum Wetter im Oberthurgau." },
      { property: "og:title", content: "Wetter-Ticker · Oberthurgauer Wetter" },
      { property: "og:description", content: "Aktuelle Kurzmeldungen zum Wetter im Oberthurgau." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedTicker() {
  const { view } = Route.useSearch();
  const { data } = useSuspenseQuery(tickerQuery());
  const posts = visiblePosts(data, Date.now());
  return (
    <EmbedShell flush>
      {posts.length === 0 ? <div /> : view === "banner" ? <TickerBanner posts={posts} /> : <TickerWidget posts={posts} />}
    </EmbedShell>
  );
}
