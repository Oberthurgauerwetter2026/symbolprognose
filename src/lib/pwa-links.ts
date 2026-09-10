/**
 * Manifest-Links pro Seite. Bewusst NICHT in __root.tsx, damit die
 * Warnkarte (/warnkarte) ein eigenes Manifest im ausgelieferten HTML hat und
 * iOS beim «Zum Home-Bildschirm» nur die Warnkarte als App anlegt.
 *
 * Die Warnkarte lädt ihr Manifest über einen Server-Endpunkt, weil das Hosting
 * die statische Datei teils mit falschem Content-Type ausliefert (iOS ignoriert
 * sie dann – „Web-App“ fehlt im Teilen-Menü).
 */
export const APP_MANIFEST_LINK = {
  rel: "manifest",
  href: "/manifest.webmanifest",
} as const;

export const WARN_MANIFEST_HREF = "/api/public/warnkarte-manifest";

export const WARN_MANIFEST_LINK = {
  rel: "manifest",
  href: WARN_MANIFEST_HREF,
} as const;
