/**
 * GitHub workflow_dispatch helper für den Blitzortung-Ingest.
 * Aufgerufen vom Cloudflare Worker Cron Trigger (alle 5 min) —
 * GitHub `schedule:` war zu unzuverlässig.
 */

import { githubDispatchEnv, postWorkflowDispatch } from "./gh-dispatch.server";

let lastDispatchAt = 0;
// Der Ingest lauscht 120 s am Blitzortung-Stream; 4 min Throttle passt zum
// 5-Min-Cron und verhindert überlappende Runs.
const MIN_INTERVAL_MS = 4 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchLightningIngest(): Promise<DispatchResult> {
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
    workflowFile: "blitzortung-ingest.yml",
    userAgent: "lovable-lightning-trigger",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref: env.ref };
}
