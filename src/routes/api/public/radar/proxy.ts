import { createFileRoute } from "@tanstack/react-router";
import { r2ObjectUrlCandidates } from "@/lib/r2-url.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function bad(status: number, msg: string) {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/radar/proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";
        // Allowlist: only radar/*.png objects.
        if (!/^radar\/[A-Za-z0-9._\-\/]+\.png$/.test(path) || path.includes("..")) {
          return bad(400, "invalid path");
        }
        const candidates = [
          ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, path),
          ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, path),
          ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, path),
        ].filter((u, i, a) => a.indexOf(u) === i);
        if (candidates.length === 0) return bad(503, "no R2 source configured");

        for (const target of candidates) {
          try {
            const res = await fetch(target, {
              cf: { cacheTtl: 3600 } as unknown as undefined,
            } as RequestInit);
            if (!res.ok) continue;
            return new Response(res.body, {
              status: 200,
              headers: {
                "Content-Type": res.headers.get("content-type") ?? "image/png",
                "Cache-Control": "public, max-age=3600, immutable",
                ...CORS,
              },
            });
          } catch {
            // try next
          }
        }
        return bad(502, "upstream fetch failed");
      },
    },
  },
});
