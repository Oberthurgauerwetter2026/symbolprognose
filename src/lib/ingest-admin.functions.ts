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

export interface AutoThunderStatus {
  ranAt: string | null;
  ageMinutes: number | null;
  detected: number;
  created: number;
  closed: number;
  note: string | null;
}

/** Status des letzten automatischen Gewitter-Laufs (Cron alle 5 Minuten). */
export const getAutoThunderStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AutoThunderStatus> => {
    const { adminClient } = await import("@/lib/warnings.server");
    const sb = await adminClient();
    const { data } = await sb
      .from("job_runs")
      .select("ran_at, detected, created, closed, note")
      .eq("job", "auto-thunder")
      .maybeSingle();
    const row = data as
      | { ran_at: string; detected: number; created: number; closed: number; note: string | null }
      | null;
    if (!row) {
      return { ranAt: null, ageMinutes: null, detected: 0, created: 0, closed: 0, note: null };
    }
    const ms = Date.parse(row.ran_at);
    return {
      ranAt: row.ran_at,
      ageMinutes: Number.isFinite(ms) ? Math.round((Date.now() - ms) / 60000) : null,
      detected: row.detected,
      created: row.created,
      closed: row.closed,
      note: row.note,
    };
  },
);

/** Gewitter-Autowarnung sofort prüfen (Admin-Passwort statt Cron-Secret). */
export const runAutoThunderNow = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const { runAutoThunder } = await import("@/lib/auto-thunder.server");
    try {
      const res = await runAutoThunder();
      return { ok: true as const, ...res };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "unbekannt" };
    }
  });

export interface PipelineHealth {
  id: string;
  label: string;
  /** Erwartetes Aktualisierungsintervall in Minuten (für die Ampel). */
  expectedEveryMin: number;
  dataGeneratedAt: string | null;
  dataAgeMinutes: number | null;
  runStatus: string | null;
  runConclusion: string | null;
  runCreatedAt: string | null;
  runUrl: string | null;
  /** Kurzbegründung zum letzten Lauf, z.B. Runner-Ausfall bei GitHub. */
  runNote?: string;
  error?: string;
}


/**
 * Diagnose aller Ingest-Pipelines: Alter der R2-Datei + letzter GitHub-Run.
 * Damit ist auf einen Blick unterscheidbar, ob der Trigger oder das
 * Ingest-Skript scheitert.
 */
export const getPipelineHealth = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }): Promise<PipelineHealth[]> => {
    const { assertAdmin } = await import("@/lib/warnings.server");
    assertAdmin(data.password);
    const { r2ObjectUrlCandidates } = await import("@/lib/r2-url.server");

    const defs = [
      { id: "radar", label: "Radar (CPC/POH)", file: "radar-ingest.yml", object: "radar/frames.json", expectedEveryMin: 5 },
      { id: "openmeteo", label: "ICON-CH1 Prognose", file: "openmeteo-ingest.yml", object: "openmeteo/forecast.json", expectedEveryMin: 30 },
      { id: "symbol", label: "Symbolprognose", file: "openmeteo-symbol.yml", object: "openmeteo/symbol.json", expectedEveryMin: 360 },
      { id: "mch", label: "MCH Local-Forecast", file: "mch-local-forecast.yml", object: "mch/local_forecast.json", expectedEveryMin: 60 },
      { id: "arome", label: "AROME-HD", file: "arome-ingest.yml", object: "arome/frames.json", expectedEveryMin: 60 },
      { id: "lightning", label: "Blitzortung", file: "blitzortung-ingest.yml", object: "lightning/latest.json", expectedEveryMin: 5 },
    ] as const;

    const token = process.env.GITHUB_DISPATCH_TOKEN;
    const repo = process.env.GITHUB_REPO;

    async function latestRun(file: string) {
      if (!token || !repo) return null;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?per_page=1`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "lovable-ingest-health",
            },
          },
        );
        if (!res.ok) return null;
        const json = (await res.json()) as {
          workflow_runs?: Array<{
            status: string;
            conclusion: string | null;
            created_at: string;
            html_url: string;
          }>;
        };
        return json.workflow_runs?.[0] ?? null;
      } catch {
        return null;
      }
    }

    async function objectAge(object: string) {
      const urls = [
        ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, object),
        ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, object),
      ].filter((u, i, a) => a.indexOf(u) === i);
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
          if (!res.ok) continue;
          const json = (await res.json()) as { generatedAt?: string };
          if (!json.generatedAt) continue;
          const ms = Date.parse(json.generatedAt);
          return {
            generatedAt: json.generatedAt,
            ageMinutes: Number.isFinite(ms) ? Math.round((Date.now() - ms) / 60000) : null,
          };
        } catch {
          // nächste URL
        }
      }
      return null;
    }

    return await Promise.all(
      defs.map(async (d): Promise<PipelineHealth> => {
        const [run, age] = await Promise.all([latestRun(d.file), objectAge(d.object)]);
        return {
          id: d.id,
          label: d.label,
          expectedEveryMin: d.expectedEveryMin,
          dataGeneratedAt: age?.generatedAt ?? null,
          dataAgeMinutes: age?.ageMinutes ?? null,
          runStatus: run?.status ?? null,
          runConclusion: run?.conclusion ?? null,
          runCreatedAt: run?.created_at ?? null,
          runUrl: run?.html_url ?? null,
          ...(age ? {} : { error: "keine Datei in R2 erreichbar" }),
        };
      }),
    );
  });
