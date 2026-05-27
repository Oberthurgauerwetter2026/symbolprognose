import { createFileRoute } from "@tanstack/react-router";
import { dispatchRadarIngest } from "@/lib/radar-dispatch.server";

/**
 * Externer Trigger-Endpoint für den Radar-Ingest-Workflow.
 * Primärer Trigger ist jetzt der Cloudflare Worker Cron (siehe src/server.ts).
 * Dieser Endpoint bleibt als manueller Fallback (curl / cron-job.org).
 *
 * Auth: Header `x-trigger-secret` == process.env.RADAR_TRIGGER_SECRET
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-trigger-secret",
} as const;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const Route = createFileRoute("/api/public/radar/ingest-trigger")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const secret = process.env.RADAR_TRIGGER_SECRET;
        if (!secret) {
          return Response.json(
            { ok: false, error: "Server misconfigured: missing RADAR_TRIGGER_SECRET" },
            { status: 500, headers: CORS_HEADERS },
          );
        }

        const provided = request.headers.get("x-trigger-secret") ?? "";
        if (!timingSafeEqual(provided, secret)) {
          return Response.json(
            { ok: false, error: "Unauthorized" },
            { status: 401, headers: CORS_HEADERS },
          );
        }

        const result = await dispatchRadarIngest();
        if (result.ok) {
          return Response.json(result, { status: 202, headers: CORS_HEADERS });
        }
        if ("throttled" in result) {
          return Response.json(result, { status: 429, headers: CORS_HEADERS });
        }
        const status = "status" in result ? 502 : 500;
        return Response.json(result, { status, headers: CORS_HEADERS });
      },
    },
  },
});
