/**
 * Cloudflare Worker — zuverlässige Trigger für Ingest-Workflows.
 *
 *   - */5 * * * *       → radar + eps
 *   - 0 2,8,14,20 * * * → symbol (phaseA, ~2 h nach Modellläufen 00/06/12/18 UTC)
 *
 * Alle Server-Endpoints haben eigene Throttles (Radar 60s, EPS 10min,
 * Symbol 30min), gleichzeitiges Pingen ist also unproblematisch.
 *
 * GitHub-Actions `schedule:` ist NICHT mehr aktiv für openmeteo-symbol,
 * weil GitHub-Schedules notorisch unzuverlässig sind. Dieser Worker ist
 * die einzige Trigger-Quelle.
 */

export interface Env {
  TARGET_URL: string;
  EPS_TARGET_URL?: string;
  SYMBOL_TARGET_URL?: string;
  RADAR_TRIGGER_SECRET: string;
}

interface RunRecord {
  at: string | null;
  status: number | null;
  body: string | null;
}

const lastRadar: RunRecord = { at: null, status: null, body: null };
const lastEps: RunRecord = { at: null, status: null, body: null };
const lastSymbol: RunRecord = { at: null, status: null, body: null };

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

async function triggerFiveMin(env: Env): Promise<void> {
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

async function triggerSymbol(env: Env): Promise<void> {
  if (!env.SYMBOL_TARGET_URL) {
    console.warn("[cron:symbol] SYMBOL_TARGET_URL not configured — skipping");
    return;
  }
  await triggerEndpoint(
    env.SYMBOL_TARGET_URL,
    env.RADAR_TRIGGER_SECRET,
    "symbol",
    lastSymbol,
  );
}

async function triggerAll(env: Env): Promise<void> {
  await Promise.all([triggerFiveMin(env), triggerSymbol(env)]);
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // event.cron unterscheidet die beiden Triggers.
    if (event.cron === "0 2,8,14,20 * * *") {
      ctx.waitUntil(triggerSymbol(env));
    } else {
      // Default = */5 * * * *
      ctx.waitUntil(triggerFiveMin(env));
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/status") {
      return Response.json({
        worker: "symbolprognose-radar-cron",
        crons: ["*/5 * * * *", "0 2,8,14,20 * * *"],
        targets: {
          radar: env.TARGET_URL,
          eps: env.EPS_TARGET_URL ?? null,
          symbol: env.SYMBOL_TARGET_URL ?? null,
        },
        lastRadar,
        lastEps,
        lastSymbol,
      });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      // Manueller Test-Trigger — pingt alle drei Endpoints.
      await triggerAll(env);
      return Response.json({ ok: true, lastRadar, lastEps, lastSymbol });
    }

    if (url.pathname === "/run/eps" && request.method === "POST") {
      if (!env.EPS_TARGET_URL) {
        return Response.json({ ok: false, error: "EPS_TARGET_URL not configured" }, { status: 500 });
      }
      await triggerEndpoint(env.EPS_TARGET_URL, env.RADAR_TRIGGER_SECRET, "eps", lastEps);
      return Response.json({ ok: true, lastEps });
    }

    if (url.pathname === "/run/radar" && request.method === "POST") {
      await triggerEndpoint(env.TARGET_URL, env.RADAR_TRIGGER_SECRET, "radar", lastRadar);
      return Response.json({ ok: true, lastRadar });
    }

    if (url.pathname === "/run/symbol" && request.method === "POST") {
      if (!env.SYMBOL_TARGET_URL) {
        return Response.json({ ok: false, error: "SYMBOL_TARGET_URL not configured" }, { status: 500 });
      }
      await triggerEndpoint(env.SYMBOL_TARGET_URL, env.RADAR_TRIGGER_SECRET, "symbol", lastSymbol);
      return Response.json({ ok: true, lastSymbol });
    }

    return new Response("Not found", { status: 404 });
  },
};
