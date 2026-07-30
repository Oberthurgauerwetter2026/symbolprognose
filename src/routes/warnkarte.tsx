import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { WarnMap } from "@/components/maps/warn-map";
import { SITE_URL } from "@/lib/site-url";

const DESC =
  "Aktuelle Wetterwarnungen für alle Gemeinden im Oberthurgau – mit Push-Benachrichtigung für die eigene Region.";

export const Route = createFileRoute("/warnkarte")({
  ssr: false,
  component: WarnkartePage,
  head: () => ({
    meta: [
      { title: "Warnkarte Oberthurgau · Benachrichtigungen abonnieren" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Warnkarte Oberthurgau · Benachrichtigungen abonnieren" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/warnkarte` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/warnkarte` }],
  }),
});

function WarnkartePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.origin !== SITE_URL) {
      window.location.replace(`${SITE_URL}/warnkarte`);
    }
  }, []);

  // Eigenes Manifest: Home-Bildschirm-Icon startet nur die Warnkarte
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const prev = link.href;
    link.href = "/warnkarte.webmanifest";
    return () => {
      link.href = prev;
    };
  }, []);


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        <header className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Wetterwarnungen Oberthurgau
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{DESC}</p>
        </header>

        <WarnMap />

        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Oberthurgauer Wetter – zur Hauptseite
          </Link>
        </footer>
      </div>
    </main>
  );
}
