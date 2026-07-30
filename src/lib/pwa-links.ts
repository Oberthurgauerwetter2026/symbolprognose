/**
 * Manifest-Links pro Seite. Bewusst NICHT in __root.tsx, damit die
 * Warnkarte (/warnkarte) ein eigenes Manifest im ausgelieferten HTML hat und
 * iOS beim «Zum Home-Bildschirm» nur die Warnkarte als App anlegt.
 */
export const APP_MANIFEST_LINK = {
  rel: "manifest",
  href: "/manifest.webmanifest",
} as const;

export const WARN_MANIFEST_LINK = {
  rel: "manifest",
  href: "/warnkarte.webmanifest",
} as const;
