import { createFileRoute } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { WarnMap } from "@/components/maps/warn-map";
import { setEmbedCacheHeaders } from "@/lib/embed-cache.functions";
import { SITE_URL } from "@/lib/site-url";

export const Route = createFileRoute("/embed/warnungen")({
  ssr: false,
  loader: async () => {
    await setEmbedCacheHeaders();
  },
  component: () => (
    <EmbedShell>
      <div className="p-2">
        <WarnMap bare />
        <div className="mt-2 rounded-lg border border-border bg-card p-2 text-xs text-foreground">
          <p className="font-medium">Push-Benachrichtigungen aktivieren</p>
          <p className="mt-1 text-muted-foreground">
            Für Wetterwarnungen per Push bitte die Warnkarte in einem eigenen Tab öffnen:
          </p>
          <a
            href={`${SITE_URL}/warnkarte`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-strong"
          >
            Warnungen abonnieren – in eigenem Tab öffnen
          </a>
        </div>
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
