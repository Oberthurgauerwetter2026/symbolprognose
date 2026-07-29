import { createServerFn } from "@tanstack/react-start";

/**
 * Admin-gesteuerte Ingest-Trigger. Nutzt denselben Dispatch-Pfad wie der
 * Cloudflare-Cron-Worker, aber mit Admin-Passwort statt Trigger-Secret —
 * damit sich der Radar-Ingest auch dann starten lässt, wenn der Worker
 * (z. B. wegen falschem Secret oder alter Ziel-URL) nicht durchkommt.
 */

export type IngestTarget = "radar" | "openmeteo" | "arome" | "mch" | "symbol";

export const runIngestNow = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; target: IngestTarget }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/warnings.server");
    assertAdmin(data.password);

    switch (data.target) {
      case "radar": {
        const { dispatchRadarIngest } = await import("@/lib/radar-dispatch.server");
        return await dispatchRadarIngest();
      }
      case "openmeteo": {
        const { dispatchOpenmeteoIngest } = await import("@/lib/openmeteo-dispatch.server");
        return await dispatchOpenmeteoIngest();
      }
      case "arome": {
        const { dispatchAromeIngest } = await import("@/lib/arome-dispatch.server");
        return await dispatchAromeIngest();
      }
      case "mch": {
        const { dispatchMchLocalForecastIngest } = await import(
          "@/lib/mch-local-forecast-dispatch.server"
        );
        return await dispatchMchLocalForecastIngest();
      }
      case "symbol": {
        const { dispatchSymbolIngest } = await import("@/lib/symbol-dispatch.server");
        return await dispatchSymbolIngest();
      }
      default:
        return { ok: false as const, error: "Unbekanntes Ziel" };
    }
  });

export interface IngestStatus {
  target: IngestTarget;
  generatedAt: string | null;
  latestFrame: string | null;
  ageMinutes: number | null;
  error?: string;
}

export const getIngestStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<IngestStatus[]> => {
    const { r2ObjectUrlCandidates } = await import("@/lib/r2-url.server");
    const objects: Array<{ target: IngestTarget; path: string }> = [
      { target: "radar", path: "radar/frames.json" },
      { target: "openmeteo", path: "radar/forecast-frames.json" },
    ];

    const out: IngestStatus[] = [];
    for (const o of objects) {
      const urls = [
        ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, o.path),
        ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, o.path),
        ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, o.path),
      ].filter((u, i, a) => a.indexOf(u) === i);

      let status: IngestStatus = {
        target: o.target,
        generatedAt: null,
        latestFrame: null,
        ageMinutes: null,
        error: "kein Manifest erreichbar",
      };

      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
          if (!res.ok) continue;
          const json = (await res.json()) as {
            generatedAt?: string;
            frames?: Array<{ t?: string }>;
          };
          const frames = Array.isArray(json.frames) ? json.frames : [];
          const times = frames
            .map((f) => (f.t ? Date.parse(f.t) : NaN))
            .filter((n) => Number.isFinite(n));
          const latest = times.length ? Math.max(...times) : null;
          const gen = json.generatedAt ? Date.parse(json.generatedAt) : NaN;
          status = {
            target: o.target,
            generatedAt: json.generatedAt ?? null,
            latestFrame: latest ? new Date(latest).toISOString() : null,
            ageMinutes: Number.isFinite(gen)
              ? Math.round((Date.now() - gen) / 60000)
              : null,
          };
          break;
        } catch {
          // nächste URL
        }
      }
      out.push(status);
    }
    return out;
  },
);
