/**
 * Gemeinsamer GitHub-`workflow_dispatch`-Helper mit Retry.
 *
 * GitHub antwortet gelegentlich mit HTTP 500
 * (`{"message":"Failed to run workflow dispatch"}`) oder 429/502/503.
 * Ohne Retry fällt dann ein kompletter Cron-Slot aus. Darum: bis zu 3
 * Versuche mit kurzem Backoff, danach Fehler zurückgeben.
 */

const RETRY_DELAYS_MS = [500, 1500];

export interface WorkflowDispatchOk {
  ok: true;
  status: number;
  attempts: number;
}

export interface WorkflowDispatchErr {
  ok: false;
  status: number;
  error: string;
  attempts: number;
}

export type WorkflowDispatchResponse = WorkflowDispatchOk | WorkflowDispatchErr;

export interface WorkflowActivityOk {
  ok: true;
  active: boolean;
  /** Ein Lauf hängt zu lange in `queued` (GitHub-Störung) — Dispatch trotzdem erlaubt. */
  stuckQueued?: {
    id: number;
    htmlUrl: string;
    createdAt: string;
    queuedForMs: number;
  };
  run?: {
    id: number;
    status: "queued" | "in_progress";
    htmlUrl: string;
    createdAt: string;
  };
  attempts: number;
}


export interface WorkflowActivityErr {
  ok: false;
  status: number;
  error: string;
  attempts: number;
}

export type WorkflowActivityResponse = WorkflowActivityOk | WorkflowActivityErr;

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Eindeutige Kennung für einen ungültigen/abgelaufenen GitHub-Token. */
export const GH_BAD_CREDENTIALS = "github-bad-credentials";

export function isBadCredentials(error: string | null | undefined): boolean {
  if (!error) return false;
  return error.includes(GH_BAD_CREDENTIALS) || error.includes("Bad credentials");
}

/** Ergänzt GitHub-401-Antworten um eine klare Handlungsanweisung. */
function annotateError(status: number, error: string): string {
  if (status !== 401) return error;
  return (
    `${GH_BAD_CREDENTIALS}: GitHub-Token ungültig — neuen GITHUB_DISPATCH_TOKEN ` +
    `hinterlegen und Projekt neu veröffentlichen. GitHub: ${error}`
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function postWorkflowDispatch(opts: {
  repo: string;
  token: string;
  ref: string;
  workflowFile: string;
  userAgent: string;
}): Promise<WorkflowDispatchResponse> {
  const url = `https://api.github.com/repos/${opts.repo}/actions/workflows/${opts.workflowFile}/dispatches`;
  let lastStatus = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": opts.userAgent,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: opts.ref }),
      });

      if (res.ok) return { ok: true, status: res.status, attempts: attempt };

      lastStatus = res.status;
      lastError = (await res.text()).slice(0, 500);

      if (!isRetryable(res.status)) {
        return {
          ok: false,
          status: lastStatus,
          error: annotateError(lastStatus, lastError),
          attempts: attempt,
        };
      }
    } catch (err) {
      lastStatus = 0;
      lastError = (err as Error).message;
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) break;
    console.warn(
      `[gh-dispatch] ${opts.workflowFile} Versuch ${attempt} fehlgeschlagen ` +
        `(status ${lastStatus}) — Retry in ${delay}ms`,
    );
    await sleep(delay);
  }

  return {
    ok: false,
    status: lastStatus,
    error: annotateError(lastStatus, lastError),
    attempts: RETRY_DELAYS_MS.length + 1,
  };
}

/**
 * Prüft vor einem Dispatch, ob derselbe Workflow bereits läuft oder wartet.
 * GitHub ersetzt sonst bei mehr als einem wartenden Run den älteren Run trotz
 * `cancel-in-progress: false`.
 */
export async function getWorkflowActivity(opts: {
  repo: string;
  token: string;
  workflowFile: string;
  userAgent: string;
}): Promise<WorkflowActivityResponse> {
  const url =
    `https://api.github.com/repos/${opts.repo}/actions/workflows/` +
    `${opts.workflowFile}/runs?per_page=20`;
  let lastStatus = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": opts.userAgent,
        },
      });

      if (res.ok) {
        const payload = (await res.json()) as {
          workflow_runs?: Array<{
            id?: number;
            status?: string;
            html_url?: string;
            created_at?: string;
          }>;
        };
        const active = payload.workflow_runs?.find(
          (run) => run.status === "queued" || run.status === "in_progress",
        );
        if (!active || typeof active.id !== "number") {
          return { ok: true, active: false, attempts: attempt };
        }
        return {
          ok: true,
          active: true,
          run: {
            id: active.id,
            status: active.status === "queued" ? "queued" : "in_progress",
            htmlUrl: active.html_url ?? "",
            createdAt: active.created_at ?? "",
          },
          attempts: attempt,
        };
      }

      lastStatus = res.status;
      lastError = (await res.text()).slice(0, 500);
      if (!isRetryable(res.status)) {
        return {
          ok: false,
          status: lastStatus,
          error: annotateError(lastStatus, lastError),
          attempts: attempt,
        };
      }
    } catch (err) {
      lastStatus = 0;
      lastError = (err as Error).message;
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) break;
    console.warn(
      `[gh-dispatch] Statusprüfung ${opts.workflowFile} Versuch ${attempt} fehlgeschlagen ` +
        `(status ${lastStatus}) — Retry in ${delay}ms`,
    );
    await sleep(delay);
  }

  return {
    ok: false,
    status: lastStatus,
    error: annotateError(lastStatus, lastError),
    attempts: RETRY_DELAYS_MS.length + 1,
  };
}

/** Minimaler Ausschnitt eines GitHub-Workflow-Runs. */
export interface GhRunSummary {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_started_at?: string;
  updated_at?: string;
}

/**
 * Läuft ein Job kürzer als eine Minute und scheitert, hat GitHub keinen
 * Runner zugewiesen ("job was not acquired by Runner of type hosted") —
 * kein Datenfehler, sondern ein Infrastrukturausfall.
 */
const INFRA_FAIL_MAX_DURATION_MS = 60_000;
const INFRA_FAIL_CONCLUSIONS = new Set(["failure", "startup_failure", "cancelled"]);

export function isInfraFailureRun(run: GhRunSummary | null | undefined): boolean {
  if (!run || run.status !== "completed") return false;
  if (!run.conclusion || !INFRA_FAIL_CONCLUSIONS.has(run.conclusion)) return false;
  if (run.conclusion === "startup_failure") return true;
  const started = Date.parse(run.run_started_at ?? run.created_at);
  const ended = Date.parse(run.updated_at ?? run.created_at);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return false;
  return ended - started < INFRA_FAIL_MAX_DURATION_MS;
}

/**
 * Liest die letzten Runs eines Workflows (neueste zuerst).
 * Gibt null zurück, wenn GitHub nicht erreichbar ist.
 */
export async function getRecentRuns(opts: {
  repo: string;
  token: string;
  workflowFile: string;
  userAgent: string;
  perPage?: number;
}): Promise<GhRunSummary[] | null> {
  const url =
    `https://api.github.com/repos/${opts.repo}/actions/workflows/` +
    `${opts.workflowFile}/runs?per_page=${opts.perPage ?? 10}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": opts.userAgent,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { workflow_runs?: GhRunSummary[] };
    const runs = (data.workflow_runs ?? []).slice();
    runs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return runs;
  } catch {
    return null;
  }
}

/**
 * Prüft, ob der letzte Lauf eines Workflows an fehlender GitHub-Infrastruktur
 * scheiterte. In diesem Fall darf der Zeit-Throttle übersprungen werden.
 */
export async function lastRunWasInfraFailure(opts: {
  repo: string;
  token: string;
  workflowFile: string;
  userAgent: string;
}): Promise<boolean> {
  const runs = await getRecentRuns({ ...opts, perPage: 5 });
  if (!runs || runs.length === 0) return false;
  return isInfraFailureRun(runs[0]);
}

/** Liest die GitHub-Env-Vars; gibt null zurück, wenn unvollständig. */
export function githubDispatchEnv(): { token: string; repo: string; ref: string } | null {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF ?? "main";
  if (!token || !repo) return null;
  return { token, repo, ref };
}
