import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WarnMap } from "@/components/maps/warn-map";
import { SITE_URL } from "@/lib/site-url";
import { WARN_MANIFEST_LINK } from "@/lib/pwa-links";

export const DESC =
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
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Oberthurgauer Wetter" },
      { name: "application-name", content: "Oberthurgauer Wetter" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "theme-color", content: "#2561a1" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/warnkarte` },
      WARN_MANIFEST_LINK,
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
});

function WarnkartePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.origin !== SITE_URL) {
      window.location.replace(`${SITE_URL}/warnkarte`);
    }
  }, []);

  // Fallback: falls doch ein anderes Manifest im DOM hängt, hier korrigieren.
  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'),
    );
    for (const l of links) {
      if (!l.href.endsWith("/warnkarte.webmanifest")) l.remove();
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement("link");
      l.rel = "manifest";
      l.href = "/warnkarte.webmanifest";
      document.head.appendChild(l);
    }
  }, []);



  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-5">
        <header className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Wetterwarnungen Oberthurgau
          </h1>
        </header>

        <WarnMap />
      </div>
    </main>
  );
}
