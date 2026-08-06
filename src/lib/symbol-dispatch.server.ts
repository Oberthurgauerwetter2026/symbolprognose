/**
 * GitHub workflow_dispatch helper for the openmeteo-symbol (phaseA) workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger.
 *
 * Throttle: 30 min. Open-Meteo Symbolprognose ändert sich nur 4× täglich
 * (~2 h nach Modellläufen 00/06/12/18 UTC), grosser Schutz ist also OK.
 */

import { githubDispatchEnv, postWorkflowDispatch } from "./gh-dispatch.server";

let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 30 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchSymbolIngest(): Promise<DispatchResult> {
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
    workflowFile: "openmeteo-symbol.yml",
    userAgent: "lovable-symbol-trigger",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error };
  }

  lastDispatchAt = now;
  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref: env.ref };
}
