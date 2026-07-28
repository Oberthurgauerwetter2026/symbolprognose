/**
 * Zentrale App-URL. Die Warnkarte inkl. Push-Benachrichtigungen läuft unter
 * der eigenen Subdomain, damit Service Worker und Berechtigungen an eine
 * stabile Origin gebunden sind.
 */
export const SITE_URL = "https://warnkarte.oberthurgauerwetter.ch";

/** Fallback-Origin, solange die eigene Domain noch nicht aktiv ist. */
export const LOVABLE_ORIGIN = "https://symbolprognose.lovable.app";

/**
 * Absolute URL für einen App-Pfad.
 *
 * Im Browser (nicht eingebettet) wird die aktuelle Origin verwendet, damit
 * Preview und Lovable-URL weiter funktionieren. In einem iframe – also im
 * WordPress-Embed – zeigen Links immer auf die eigene Domain, weil Push dort
 * registriert werden muss.
 */
export function getAppUrl(path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return `${SITE_URL}${suffix}`;
  let framed = true;
  try {
    framed = window.top !== window.self;
  } catch {
    framed = true;
  }
  const base = framed ? SITE_URL : window.location.origin;
  return `${base}${suffix}`;
}
