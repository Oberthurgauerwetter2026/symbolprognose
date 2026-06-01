import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

/**
 * Setzt aggressive CDN-Cache-Header für Embed-Routen.
 * Wird aus dem Route-Loader aufgerufen; läuft nur server-seitig.
 */
export const setEmbedCacheHeaders = createServerFn({ method: "GET" }).handler(
  async () => {
    setResponseHeaders(
      new Headers({
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      }),
    );
    return null;
  },
);
