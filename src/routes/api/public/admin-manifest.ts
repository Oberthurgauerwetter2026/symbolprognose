/**
 * App-Profil (Web App Manifest) des Redaktions-Tools mit korrektem Dateityp.
 *
 * Die statische Datei public/warnkarte.webmanifest wird vom Hosting teils als
 * application/octet-stream ausgeliefert – iOS ignoriert das Profil dann, die
 * Zeile „Web-App“ fehlt beim Speichern auf den Home-Bildschirm und Push ist
 * damit unmöglich. Dieser Endpunkt setzt den Typ verbindlich.
 */
import { createFileRoute } from "@tanstack/react-router";

const MANIFEST = {
  name: "OWT Redaktion",
  short_name: "OWT Redaktion",
  description:
    "Ticker, Wetterbericht und Warnungen von Oberthurgauer Wetter verwalten.",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  background_color: "#f4f4f5",
  theme_color: "#2561a1",
  orientation: "portrait-primary",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
  id: "/admin",
} as const;

export const Route = createFileRoute("/api/public/admin-manifest")({
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
