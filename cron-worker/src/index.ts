/**
 * Cloudflare Worker — zuverlässiger 5-Min-Trigger für Radar- und EPS-Ingest.
 *
 * Pingt alle 5 Minuten zwei Lovable-Endpoints:
 *   - /api/public/radar/ingest-trigger  → dispatched radar-ingest.yml
 *   - /api/public/eps/ingest-trigger    → dispatched icon-eps-ingest.yml
 *
 * Beide Server-Endpoints haben eigene Throttles (Radar 60s, EPS 10min),
 * sodass das gleichzeitige 5-Min-Pingen unproblematisch ist.
 *
 * GitHub-Actions `schedule:` läuft als Backup.
 */

export interface Env {
  TARGET_URL: string;
  EPS_TARGET_URL?: string;
  RADAR_TRIGGER_SECRET: string;
}

interface RunRecord {
  at: string | null;
  status: number | null;
  body: string | null;
}

const lastRadar: RunRecord = { at: null, status: null, body: null };
const lastEps: RunRecord = { at: null, status: null, body: null };

async function triggerEndpoint(
  url: string,
  secret: string,
  label: string,
  record: RunRecord,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-trigger-secret": secret,
        "Content-Type": "application/json",
        "User-Agent": `symbolprognose-cron/${label}`,
      },
      body: "{}",
    });
    const text = await res.text();
    record.at = startedAt;
    record.status = res.status;
    record.body = text.slice(0, 300);

    if (res.status === 202) {
      console.log(`[cron:${label}] ${startedAt} → 202 dispatched: ${record.body}`);
    } else if (res.status === 429) {
      console.log(`[cron:${label}] ${startedAt} → 429 throttled: ${record.body}`);
    } else {
      console.error(
        `[cron:${label}] ${startedAt} → ${res.status} unexpected: ${record.body}`,
      );
    }
  } catch (err) {
    record.at = startedAt;
    record.status = -1;
    record.body = (err as Error).message;
    console.error(`[cron:${label}] ${startedAt} → fetch error: ${record.body}`);
  }
}

async function triggerAll(env: Env): Promise<void> {
  const tasks: Promise<void>[] = [];
  tasks.push(
    triggerEndpoint(env.TARGET_URL, env.RADAR_TRIGGER_SECRET, "radar", lastRadar),
  );
  if (env.EPS_TARGET_URL) {
    tasks.push(
      triggerEndpoint(env.EPS_TARGET_URL, env.RADAR_TRIGGER_SECRET, "eps", lastEps),
    );
  }
  await Promise.all(tasks);
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(triggerAll(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/status") {
      return Response.json({
        wor