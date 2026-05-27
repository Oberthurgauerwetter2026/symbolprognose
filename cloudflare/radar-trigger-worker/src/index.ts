/**
 * Cloudflare Worker: pingt alle 5 Minuten den Radar-Ingest-Trigger.
 *
 * Secrets (wrangler secret put ...):
 *   - TRIGGER_URL    z.B. https://symbolprognose.lovable.app/api/public/radar/ingest-trigger
 *   - TRIGGER_SECRET muss exakt dem RADAR_TRIGGER_SECRET in Lovable Cloud entsprechen
 */

export interface Env {
  TRIGGER_URL: string;
  TRIGGER_SECRET: string;
}

async function trigger(env: Env): Promise<void> {
  if (!env.TRIGGER_URL || !env.TRIGGER_SECRET) {
    console.error("Missing TRIGGER_URL or TRIGGER_SECRET");
    return;
  }
  const startedAt = Date.now();
  try {
    const res = await fetch(env.TRIGGER_URL, {
      method: "POST",
      headers: {
        "x-trigger-secret": env.TRIGGER_SECRET,
        "Content-Type": "application/json",
        "User-Agent": "radar-trigger-worker",
      },
      body: "{}",
    });
    const text = await res.text();
    const took = Date.now() - startedAt;
    console.log(
      `trigger status=${res.status} took=${took}ms body=${text.slice(0, 200)}`,
    );
  } catch (err) {
    console.error("trigger failed:", err);
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(trigger(env));
  },

  // Optional: manueller Test via HTTP GET (z.B. wrangler dev).
  async fetch(_request: Request, env: Env) {
    await trigger(env);
    return new Response("ok", { status: 200 });
  },
};
