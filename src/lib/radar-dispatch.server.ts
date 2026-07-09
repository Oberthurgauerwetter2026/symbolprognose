/**
 * GitHub workflow_dispatch helper for the radar-ingest workflow.
 * Aufgerufen von:
 *   - Cloudflare Worker Cron Trigger (src/server.ts → scheduled)
 *   - HTTP-Endpoint (src/routes/api/public/radar/ingest-trigger.ts) als Fallback
 */

let lastDispatchAt = 0;
// 4 min: verhindert, dass GitHub Actions einen zweiten Run in die
// `radar-ingest` Concurrency-Queue schiebt und den älteren wartenden Run
// cancelt ("Canceling since a higher priority waiting request ... exists").
// Cloudflare-Cron feuert alle 5 min; überschüssige Trigger werden mit 429
// (throttled) beantwortet.
const MIN_INTERVAL_MS = 4 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchRadarIngest(): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF ?? "main";

  if (!token || !repo) {
    return { ok: false, error: "Server misconfigured: missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO" };
  }

  const now = Date.now();
  if (now - lastDispatchAt < MIN_INTERVAL_MS) {
    return { ok: false, throttled: true, retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt) };
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
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref };
}
