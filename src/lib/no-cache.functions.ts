import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

/**
 * Verhindert das Zwischenspeichern der HTML-Seite.
 *
 * Nötig für die Warnkarte: gespeicherte Home-Bildschirm-Apps und Browser
 * hielten sonst eine alte Fassung (ohne die neuen Hilfestellungen) fest.
 */
export const setNoStoreHeaders = createServerFn({ method: "GET" }).handler(
  async () => {
    setResponseHeaders(
      new Headers({
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      }),
    );
    return null;
  },
);
