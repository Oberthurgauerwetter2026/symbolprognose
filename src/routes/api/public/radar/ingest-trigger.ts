import { createFileRoute } from "@tanstack/react-router";

/**
 * Externer Trigger-Endpoint für den Radar-Ingest-Workflow.
 * Wird vom Cloudflare-Worker-Cron alle 5 min aufgerufen.
 *
 * Auth: Header `x-trigger-secret` == process.env.RADAR_TRIGGER_SECRET
 * Action: workflow_dispatch auf radar-ingest.yml via GitHub API.
 *
 * Required env:
 *   - RADAR_TRIGGER_SECRET   (Shared Secret, vom Worker mitgeschickt)
 *   - GITHUB_DISPATCH_TOKEN  (Fine-grained PAT, Actions: read+write)
 *   - GITHUB_REPO            (z.B. "user/repo")
 *   - GITHUB_REF             (optional, default "main")
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-trigger-secret",
} as const;

// Module-level Throttle: max 1 Dispatch pro 60s pro Worker-Instanz.
let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 60_000;

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
        const token = process.env.GITHUB_DISPATCH_TOKEN;
        const repo = process.env.GITHUB_REPO;
        const ref = process.env.GITHUB_REF ?? "main";

        if (!secret || !token || !repo) {
          return Response.json(
            { ok: false, error: "Server misconfigured: missing env vars" },
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

        const now = Date.now();
        if (now - lastDispatchAt < MIN_INTERVAL_MS) {
          return Response.json(
            {
              ok: false,
              throttled: true,
              retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt),
            },
            { status: 429, headers: CORS_HEADERS },
          );
        }

        const url = `https://api.github.com/repos/${repo}/actions/workflows/radar-ingest.yml/dispatches`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lovable-radar-trigger",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref }),
        });

        if (!res.ok) {
          const text = await res.text();
          return Response.json(
            { ok: false, status: res.status, error: text.slice(0, 500) },
            { status: 502, headers: CORS_HEADERS },
          );
        }

        lastDispatchAt = now;
        return Response.json(
          { ok: true, dispatchedAt: new Date(now).toISOString(), ref },
          { status: 202, headers: CORS_HEADERS },
        );
      },
    },
  },
});
