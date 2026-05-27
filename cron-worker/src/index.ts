/**
 * Cloudflare Worker — zuverlässiger 5-Min-Trigger für den Radar-Ingest.
 *
 * Pingt alle 5 Minuten den Lovable-Endpoint /api/public/radar/ingest-trigger,
 * der seinerseits den GitHub-Actions-Workflow `radar-ingest.yml` dispatched.
 *
 * GitHub-Actions `schedule:` läuft weiter als Backup; der 60-s-Throttle im
 * Server verhindert Doppel-Runs.
 */

export interface Env {
  TARGET_URL: string;
  RADAR_TRIGGER_SECRET: string;
}

let lastRunAt: string | null = null;
let lastStatus: number | null = null;
let lastBody: string | null = null;

async function triggerIngest(env: Env): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const res = await fetch(env.TARGET_URL, {
      method: "POST",
      headers: {
        "x-trigger-secret": env.RADAR_TRIGGER_SECRET,
        "Content-Type": "application/json",
        "User-Agent": "symbolprognose-radar-cron/1.0",
      },
      body: "{}",
    });
    const text = await res.text();
    lastRunAt = startedAt;
    lastStatus = res.status;
    lastBody = text.slice(0, 300);

    if (res.status === 202) {
      console.log(`[cron] ${startedAt} → 202 dispatched: ${lastBody}`);
    } else if (res.status === 429) {
      console.log(`[cron] ${startedAt} → 429 throttled: ${lastBody}`);
    } else {
      console.error(
        `[cron] ${startedAt} → ${res.status} unexpected: ${lastBody}`,
      );
    }
  } catch (err) {
    lastRunAt = startedAt;
    lastStatus = -1;
    lastBody = (err as Error).message;
    console.error(`[cron] ${startedAt} → fetch error: ${lastBody}`);
  }
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(triggerIngest(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/status") {
      return Response.json({
        worker: "symbolprognose-radar-cron",
        target: env.TARGET_URL,
        cron: "*/5 * * * *",
        lastRunAt,
        lastStatus,
        lastBody,
      });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      // Manueller Test-Trigger (kein Auth — Worker ist anonym erreichbar,
      // der Endpoint dahinter ist via Secret geschützt).
      await triggerIngest(env);
      return Response.json({ ok: true, lastRunAt, lastStatus, lastBody });
    }

    return new Response("Not found", { status: 404 });
  },
};
