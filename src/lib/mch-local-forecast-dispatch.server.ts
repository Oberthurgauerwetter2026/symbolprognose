/**
 * GitHub workflow_dispatch helper for the mch-local-forecast workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger (stündlich).
 *
 * Throttle: 5 min. MCH OGD wird stündlich erneuert, daher gedeckelt.
 */

import { githubDispatchEnv, postWorkflowDispatch } from "./gh-dispatch.server";

let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 5 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchMchLocalForecastIngest(): Promise<DispatchResult> {
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
    workflowFile: "mch-local-forecast.yml",
    userAgent: "lovable-mch-local-forecast-trigger",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref: env.ref };
}
