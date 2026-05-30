/**
 * GitHub workflow_dispatch helper for the openmeteo-symbol (phaseA) workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger.
 *
 * Throttle: 30 min. Open-Meteo Symbolprognose ändert sich nur 4× täglich
 * (~2 h nach Modellläufen 00/06/12/18 UTC), grosser Schutz ist also OK.
 */

let lastDispatchAt = 0;
const MIN_INTERVAL_MS = 30 * 60_000;

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function dispatchSymbolIngest(): Promise<DispatchResult> {
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

  const url = `https://api.github.com/repos/${repo}/actions/workflows/openmeteo-symbol.yml/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lovable-symbol-trigger",
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
