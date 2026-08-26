/**
 * GitHub workflow_dispatch helper for the radar-ingest workflow.
 * Aufgerufen von:
 *   - Cloudflare Worker Cron Trigger (cron-worker/) alle 5 min
 *   - HTTP-Endpoint (src/routes/api/public/radar/ingest-trigger.ts) als Fallback
 *
 * Transiente GitHub-Fehler (500/429) werden im gemeinsamen Helper
 * automatisch wiederholt; der Throttle wird nur bei Erfolg gesetzt.
 */

import {
  cancelWorkflowRun,
  getWorkflowActivity,
  githubDispatchEnv,
  lastRunWasInfraFailure,
  postWorkflowDispatch,
} from "./gh-dispatch.server";


let lastDispatchAt = 0;
// 4 min: verhindert, dass GitHub Actions einen zweiten Run in die
// `radar-ingest` Concurrency-Queue schiebt und den älteren wartenden Run
// cancelt ("Canceling since a higher priority waiting request ... exists").
// Cloudflare-Cron feuert alle 5 min; überschüssige Trigger werden mit 429
// (throttled) beantwortet.
const MIN_INTERVAL_MS = 4 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string; retryAfterRunnerFailure?: true }
  | {
      ok: false;
      alreadyRunning: true;
      runId: number;
      runStatus: "queued" | "in_progress";
      runUrl: string;
    }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchRadarIngest(): Promise<DispatchResult> {
  const env = githubDispatchEnv();
  if (!env) {
    return { ok: false, error: "Server misconfigured: missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO" };
  }

  const now = Date.now();
  // Zeit-Throttle greift nicht, wenn der letzte Lauf an fehlender
  // GitHub-Infrastruktur scheiterte ("job was not acquired by Runner").
  const withinThrottle = now - lastDispatchAt < MIN_INTERVAL_MS;
  const infraRetry = withinThrottle
    ? await lastRunWasInfraFailure({
        repo: env.repo,
        token: env.token,
        workflowFile: "radar-ingest.yml",
        userAgent: "lovable-radar-trigger",
      })
    : false;
  if (withinThrottle && !infraRetry) {
    return { ok: false, throttled: true, retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt) };
  }

  const activity = await getWorkflowActivity({
    repo: env.repo,
    token: env.token,
    workflowFile: "radar-ingest.yml",
    userAgent: "lovable-radar-trigger",
  });
  if (!activity.ok) {
    return { ok: false, status: activity.status, error: activity.error };
  }
  if (activity.active && activity.run) {
    return {
      ok: false,
      alreadyRunning: true,
      runId: activity.run.id,
      runStatus: activity.run.status,
      runUrl: activity.run.htmlUrl,
    };
  }
  let cancelledStuckRun: number | undefined;
  if (activity.stuckQueued) {
    const cancelled = await cancelWorkflowRun({
      repo: env.repo,
      token: env.token,
      runId: activity.stuckQueued.id,
      userAgent: "lovable-radar-trigger",
    });
    if (cancelled) cancelledStuckRun = activity.stuckQueued.id;
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
  return {
    ok: true,
    dispatchedAt: new Date(now).toISOString(),
    ref: env.ref,
    ...(infraRetry ? { retryAfterRunnerFailure: true as const } : {}),
  };
}
