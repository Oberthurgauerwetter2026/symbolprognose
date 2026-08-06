/**
 * GitHub workflow_dispatch helper für den AROME-HD-Ingest.
 * Aufgerufen von:
 *   - Cloudflare Worker Cron (cron-worker/src/index.ts) stündlich
 *   - HTTP-Endpoint (src/routes/api/public/arome/ingest-trigger.ts) als Fallback
 */

import { githubDispatchEnv, postWorkflowDispatch } from "./gh-dispatch.server";

let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 5 * 60_000; // AROME läuft 4×/h auf Modellseite — kein Sinn häufiger zu dispatchen

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchAromeIngest(): Promise<DispatchResult> {
  const env = githubDispatchEnv();
  if (!env) {
    return {
      ok: false,
      error: "Server misconfigured: missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO",
    };
  }

  const now = Date.now();
  if (now - lastDispatchAt < MIN_INTERVAL_MS) {
    return { ok: false, throttled: true, retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt) };
  }

  const res = await postWorkflowDispatch({
    ...env,
    workflowFile: "arome-ingest.yml",
    userAgent: "lovable-arome-trigger",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref: env.ref };
}
