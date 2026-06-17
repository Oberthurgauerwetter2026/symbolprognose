/**
 * GitHub workflow_dispatch helper for the openmeteo-ingest workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger (alle 15 min).
 *
 * Schutzmechanismen, in dieser Reihenfolge:
 *   1. In-Memory-Throttle (30 s) gegen Doppelklicks / Race-Bursts.
 *   2. Aktive-Run-Check via GitHub API: existiert bereits ein Run im
 *      Status queued/waiting/pending/requested/in_progress für
 *      `openmeteo-ingest.yml`, wird KEIN neuer Dispatch ausgelöst.
 *
 * Hintergrund: `concurrency.cancel-in-progress: false` erlaubt nur
 * EINEN wartenden Run. Ein dritter Dispatch killt den wartenden mit
 * „Canceling since a higher priority waiting request …". Wir dürfen
 * also gar nicht erst dispatchen, wenn schon einer wartet.
 */

let lastDispatchAt = 0;
// Cron triggert alle 15 min. Ein Open-Meteo-Ingest dauert oft >5 min;
// wenn ein zweiter Dispatch zu früh kommt und der erste noch wartet,
// verwirft GitHub den wartenden Run mit „higher priority waiting request".
// Daher mindestens 14 min Pause zwischen Dispatches aus derselben Instanz.
const MIN_INTERVAL_MS = 14 * 60_000;

const ACTIVE_STATUSES = new Set([
  "queued",
  "waiting",
  "pending",
  "requested",
  "in_progress",
]);

export type DispatchResult =
  | { ok: true; dispatchedAt: string; ref: string }
  | { ok: false; throttled: true; retryInMs: number; reason: "interval" }
  | {
      ok: false;
      throttled: true;
      reason: "active-run";
      activeRun: { id: number; status: string; htmlUrl: string; createdAt: string };
    }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

interface GhRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

async function findActiveRun(
  repo: string,
  token: string,
): Promise<GhRun | null> {
  const url =
    `https://api.github.com/repos/${repo}/actions/workflows/openmeteo-ingest.yml/runs` +
    `?per_page=10`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lovable-openmeteo-trigger",
    },
  });
  if (!res.ok) return null; // fail-open: lieber dispatchen als gar nichts
  const data = (await res.json()) as { workflow_runs?: GhRun[] };
  for (const run of data.workflow_runs ?? []) {
    if (ACTIVE_STATUSES.has(run.status)) return run;
  }
  return null;
}

export async function dispatchOpenmeteoIngest(): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF ?? "main";

  if (!token || !repo) {
    return { ok: false, error: "Server misconfigured: missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO" };
  }

  const now = Date.now();
  if (now - lastDispatchAt < MIN_INTERVAL_MS) {
    return {
      ok: false,
      throttled: true,
      reason: "interval",
      retryInMs: MIN_INTERVAL_MS - (now - lastDispatchAt),
    };
  }

  const active = await findActiveRun(repo, token);
  if (active) {
    return {
      ok: false,
      throttled: true,
      reason: "active-run",
      activeRun: {
        id: active.id,
        status: active.status,
        htmlUrl: active.html_url,
        createdAt: active.created_at,
      },
    };
  }

  // Throttle sofort setzen, damit ein zweiter Request aus derselben
  // Instanz, der parallel ankommt, sicher geblockt wird — auch wenn
  // der GitHub-POST unten noch in-flight ist.
  lastDispatchAt = now;

  const url = `https://api.github.com/repos/${repo}/actions/workflows/openmeteo-ingest.yml/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lovable-openmeteo-trigger",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref }),
  });

  if (!res.ok) {
    // Dispatch fehlgeschlagen → Throttle wieder freigeben, damit der
    // nächste Cron-Tick einen neuen Versuch starten darf.
    lastDispatchAt = 0;
    const text = await res.text();
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }

  return { ok: true, dispatchedAt: new Date(now).toISOString(), ref };
}
