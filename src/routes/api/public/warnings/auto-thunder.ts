import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-Endpoint: erkennt Gewitterzellen im Radar-/Nowcast-Feld und setzt
 * bzw. beendet automatische Gewitterwarnungen für die betroffenen Gemeinden.
 * Aufruf mit Header `x-trigger-secret`.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export const Route = createFileRoute("/api/public/warnings/auto-thunder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RADAR_TRIGGER_SECRET;
        if (!secret) return Response.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
        const provided = request.headers.get("x-trigger-secret") ?? "";
        if (!timingSafeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });

        try {
          const { runAutoThunder } = await import("@/lib/auto-thunder.server");
          const result = await runAutoThunder();
          return Response.json({ ok: true, ...result }, { status: 202 });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "unknown" },
            { status: 500 },
          );
        }
      },
    },
  },
});
