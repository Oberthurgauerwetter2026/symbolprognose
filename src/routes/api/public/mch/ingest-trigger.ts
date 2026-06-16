import { createFileRoute } from "@tanstack/react-router";
import { dispatchMchLocalForecastIngest } from "@/lib/mch-local-forecast-dispatch.server";

/**
 * Externer Trigger-Endpoint für den MCH-local-forecast-Ingest-Workflow.
 * Primärer Trigger ist der Cloudflare Worker Cron (cron-worker/) stündlich.
 *
 * Auth: Header `x-trigger-secret` == process.env.RADAR_TRIGGER_SECRET.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-trigger-secret, apikey, authorization",
} as const;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const Route = createFileRoute("/api/public/mch/ingest-trigger")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const secret = process.env.RADAR_TRIGGER_SECRET;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!secret) {
          return Response.json(
            { ok: false, error: "Server misconfigured: missing RADAR_TRIGGER_SECRET" },
            { status: 500, headers: CORS_HEADERS },
          );
        }

        const providedSecret = request.headers.get("x-trigger-secret") ?? "";
        const providedApiKey =
          request.headers.get("apikey") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

        const secretOk = timingSafeEqual(providedSecret, secret);
        const apiKeyOk =
          !!publishableKey &&
          !!providedApiKey &&
          timingSafeEqual(providedApiKey, publishableKey);

        if (!secretOk && !apiKeyOk) {
          return Response.json(
            { ok: false, error: "Unauthorized" },
            { status: 401, headers: CORS_HEADERS },
          );
        }

        const result = await dispatchMchLocalForecastIngest();
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
