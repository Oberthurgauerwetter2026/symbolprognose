/**
 * App-Profil (Web App Manifest) der Admin-Tickers mit korrektem Dateityp.
 *
 * Die statische Datei public/warnkarte.webmanifest wird vom Hosting teils als
 * application/octet-stream ausgeliefert – iOS ignoriert das Profil dann, die
 * Zeile „Web-App“ fehlt beim Speichern auf den Home-Bildschirm und Push ist
 * damit unmöglich. Dieser Endpunkt setzt den Typ verbindlich.
 */
import { createFileRoute } from "@tanstack/react-router";

const MANIFEST = {
  name: "Ticker Admin",
  short_name: "Ticker Admin",
  description:
    "Meldungen für den Wetter-Ticker erfassen, mit Push bei neuen Leserfotos.",
  start_url: "/admin-ticker",
  scope: "/admin-ticker",
  display: "standalone",
  background_color: "#f4f4f5",
  theme_color: "#2561a1",
  orientation: "portrait-primary",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
  id: "/admin-ticker",
} as const;

export const Route = createFileRoute("/api/public/admin-ticker-manifest")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(MANIFEST), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=300",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
