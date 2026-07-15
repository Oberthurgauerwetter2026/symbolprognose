/**
 * GitHub workflow_dispatch helper for the openmeteo-ingest workflow.
 * Aufgerufen vom Cloudflare Worker Cron Trigger (alle 30 min).
 *
 * Schutzmechanismen, in dieser Reihenfolge:
 *   1. In-Memory-Throttle gegen Doppelklicks / Race-Bursts derselben Instanz.
 *   2. Aktive-Run-Check via GitHub API: existiert bereits ein Run im
 *      Status queued/waiting/pending/requested/in_progress für
 *      `openmeteo-ingest.yml`, wird KEIN neuer Dispatch ausgelöst.
 *   3. Recent-Run-Guard via GitHub API: nur erfolgreiche oder noch nicht
 *      abgeschlossene Runs blockieren. Fehlgeschlagene Runs dürfen sofort
 *      neu versucht werden, damit die Radar-Prognose nicht dauerhaft fehlt.
 */

// Cron triggert Open-Meteo alle 30 min. Der Ingest dauert oft mehrere
// Minuten; ein zweiter Dispatch innerhalb desselben Slots würde GitHub
// veranlassen, einen wartenden Run mit "higher priority waiting request"
// abzubrechen.
const RECENT_RUN_GUARD_MS = 28 * 60_000;
const MIN_INTERVAL_MS = RECENT_RUN_GUARD_MS;

let lastDispatchAt = 0;

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
  | {
      ok: false;
      throttled: true;
      reason: "recent-run";
      recentRun: {
        id: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        createdAt: string;
        ageMs: number;
      };
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

async function fetchRecentRuns(
  repo: string,
  token: string,
): Promise<GhRun[] | null> {
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
  if (!res.ok) return null;
  const data = (await res.json()) as { workflow_runs?: GhRun[] };
  const runs = (data.workflow_runs ?? []).slice();
  runs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return runs;
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

  const runs = await fetchRecentRuns(repo, token);
  if (runs) {
    const active = runs.find((r) => ACTIVE_STATUSES.has(r.status));
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
    const latest = runs[0];
    if (latest) {
      const ageMs = now - new Date(latest.created_at).getTime();
      const blocksRetry = latest.status !== "completed" || latest.conclusion === "success";
      if (blocksRetry && ageMs < RECENT_RUN_GUARD_MS) {
        return {
          ok: false,
          throttled: true,
          reason: "recent-run",
          recentRun: {
            id: latest.id,
            status: latest.status,
            conclusion: latest.conclusion,
            htmlUrl: latest.html_url,
            createdAt: latest.created_at,
            ageMs,
          },
        };
      }
    }
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

