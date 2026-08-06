/**
 * GitHub workflow_dispatch helper for the mch-local-forecast workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger (stündlich).
 *
 * Throttle: 5 min. MCH OGD wird stündlich erneuert, daher gedeckelt.
 */

import {
  githubDispatchEnv,
  lastRunWasInfraFailure,
  postWorkflowDispatch,
} from "./gh-dispatch.server";

let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 5 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string; retryAfterRunnerFailure?: true }
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
  // Zeit-Throttle greift nicht, wenn der letzte Lauf an fehlender
  // GitHub-Infrastruktur scheiterte ("job was not acquired by Runner") —
  // dann darf sofort nachgeholt werden.
  const withinThrottle = now - lastDispatchAt < MIN_INTERVAL_MS;
  const infraRetry = withinThrottle
    ? await lastRunWasInfraFailure({
        repo: env.repo,
        token: env.token,
        workflowFile: "mch-local-forecast.yml",
        userAgent: "lovable-mch-local-forecast-trigger",
      })
    : false;
  if (withinThrottle && !infraRetry) {
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
  return {
    ok: true,
    dispatchedAt: new Date(now).toISOString(),
    ref: env.ref,
    ...(infraRetry ? { retryAfterRunnerFailure: true as const } : {}),
  };
}
