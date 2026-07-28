/**
 * Zentrale App-URL. Die Warnkarte inkl. Push-Benachrichtigungen läuft unter
 * der eigenen Subdomain, damit Service Worker und Berechtigungen an eine
 * stabile Origin gebunden sind.
 */
export const SITE_URL = "https://warnkarte-oberthurgau.lovable.app";


/** Origins, die zum Entwickeln/Testen dienen und nie umgeschrieben werden. */
function isPreviewOrigin(origin: string): boolean {
  return (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("id-preview--") ||
    origin.includes("-dev.lovable.app") ||
    origin.includes(".lovableproject.com")
  );
}

/**
 * Absolute URL für einen App-Pfad.
 *
 * Im Browser (nicht eingebettet) wird die aktuelle Origin verwendet, damit
 * Preview und Lovable-URL weiter funktionieren. In einem iframe – also im
 * WordPress-Embed – zeigen Links auf die eigene Domain, weil Push dort
 * registriert werden muss. Ausnahme: läuft die App in einer Preview-Umgebung,
 * bleibt die aktuelle Origin erhalten, damit vor dem Domain-Go-Live getestet
 * werden kann.
 */
export function getAppUrl(path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return `${SITE_URL}${suffix}`;

  const origin = window.location.origin;
  if (isPreviewOrigin(origin)) return `${origin}${suffix}`;

  let framed = true;
  try {
    framed = window.top !== window.self;
  } catch {
    framed = true;
  }
  const base = framed ? SITE_URL : origin;
  return `${base}${suffix}`;
}

