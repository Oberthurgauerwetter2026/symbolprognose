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

// Missing data must not be decoded or cached as a dry precipitation field.
function unavailableFrame() {
  return new Response("Radar frame unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
      "X-Radar-Frame": "missing",
      ...CORS,
    },
  });
}


// Kleiner Zwischenspeicher pro Serverinstanz: Die Bilder sind unveränderlich und
// nur wenige kB gross. So trifft ein erneutes Laden der Karte nicht jedes Mal
// den Bildspeicher, der bei vielen Abrufen in kurzer Zeit drosselt.
const FRAME_TTL_MS = 3600_000;
const FRAME_CACHE_MAX = 900;
const FRAME_MAX_BYTES = 400_000;
const frameCache = new Map<string, { at: number; type: string; body: ArrayBuffer }>();

function frameResponse(type: string, body: ArrayBuffer) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600, immutable", ...CORS },
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
        if (candidates.length === 0) return unavailableFrame();

        const cached = frameCache.get(path);
        if (cached && Date.now() - cached.at < FRAME_TTL_MS) return frameResponse(cached.type, cached.body);

        // Kurze Aussetzer des Bildspeichers (Verbindungsabbruch, 429/5xx) zweimal
        // wiederholen; ein echtes 404 bleibt sofort ein fehlendes Bild.
        for (let attempt = 0; attempt < 3; attempt++) {
          let transient = false;
          for (const target of candidates) {
            try {
              const res = await fetch(target, {
                cf: { cacheTtl: 3600 } as unknown as undefined,
              } as RequestInit);
              if (!res.ok) {
                console.warn(`[radar-proxy] ${res.status} ${target}`);
                if (res.status === 429 || res.status >= 500) transient = true;
                continue;
              }
              const type = res.headers.get("content-type") ?? "image/png";
              const body = await res.arrayBuffer();
              if (body.byteLength <= FRAME_MAX_BYTES) {
                if (frameCache.size >= FRAME_CACHE_MAX) {
                  const oldest = frameCache.keys().next().value;
                  if (oldest !== undefined) frameCache.delete(oldest);
                }
                frameCache.set(path, { at: Date.now(), type, body });
              }
              return frameResponse(type, body);
            } catch (error) {
              console.warn(`[radar-proxy] fetch failed ${target}: ${error instanceof Error ? `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error)}`);
              transient = true;
            }
          }
          if (!transient) break;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 800));
        }
        return unavailableFrame();
      },
    },
  },
});
