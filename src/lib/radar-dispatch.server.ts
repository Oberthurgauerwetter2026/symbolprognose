/**
 * GitHub workflow_dispatch helper for the radar-ingest workflow.
 * Aufgerufen von:
 *   - Cloudflare Worker Cron Trigger (cron-worker/) alle 5 min
 *   - HTTP-Endpoint (src/routes/api/public/radar/ingest-trigger.ts) als Fallback
 *
 * Transiente GitHub-Fehler (500/429) werden im gemeinsamen Helper
 * automatisch wiederholt; der Throttle wird nur bei Erfolg gesetzt.
 */

import { githubDispatchEnv, postWorkflowDispatch } from "./gh-dispatch.server";

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
  const env = githubDispatchEnv();
  if (!env) {
    return { ok: false, error: "Server misconfigured: missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO" };
  }

  const now = Date.now();
  if (now - lastDispatchAt < MIN_INTERVAL_MS) {
    return { ok: false, throttled: true, retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt) };
  }

  const res = await postWorkflowDispatch({
    ...env,
    workflowFile: "radar-ingest.yml",
    userAgent: "lovable-radar-trigger",
  });

  if (!res.ok) {
    // Throttle NICHT setzen — der nächste Cron-Tick darf sofort nachholen.
    return { ok: false, status: res.status, error: res.error };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref: env.ref };
}
