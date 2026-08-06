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
        return { ok: false, status: lastStatus, error: lastError, attempts: attempt };
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
    error: lastError,
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
        return { ok: false, status: lastStatus, error: lastError, attempts: attempt };
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
    error: lastError,
    attempts: RETRY_DELAYS_MS.length + 1,
  };
}

/** Liest die GitHub-Env-Vars; gibt null zurück, wenn unvollständig. */
export function githubDispatchEnv(): { token: string; repo: string; ref: string } | null {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF ?? "main";
  if (!token || !repo) return null;
  return { token, repo, ref };
}
