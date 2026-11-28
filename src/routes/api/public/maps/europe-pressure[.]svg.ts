import { createFileRoute } from "@tanstack/react-router";
import { fetchR2, r2ObjectUrlCandidates } from "@/lib/r2-url.server";

// Published by .github/workflows/pressure-map.yml (pressure-map-generator/).
const KEY = "maps/europe-pressure-latest.svg";

export const Route = createFileRoute("/api/public/maps/europe-pressure.svg")({
  server: {
    handlers: {
      GET: async () => {
        const candidates = [
          ...r2ObjectUrlCandidates(process.env["R2_PUBLIC_URL"], KEY),
          ...r2ObjectUrlCandidates(process.env["RADAR_R2_PUBLIC_URL"], KEY),
          ...r2ObjectUrlCandidates(process.env["RADAR_MANIFEST_URL"], KEY),
        ];
        for (const url of [...new Set(candidates)]) {
          try {
            const res = await fetchR2(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            return new Response(res.body, {
              status: 200,
              headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "public, max-age=900",
                // The map is only ever shown as an image; never let it run as a document.
                "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
                "X-Content-Type-Options": "nosniff",
              },
            });
          } catch {
            // next candidate
          }
        }
        return new Response("Druckkarte momentan nicht verfügbar", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
