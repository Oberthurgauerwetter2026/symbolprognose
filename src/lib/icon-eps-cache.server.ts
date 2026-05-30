/**
 * R2-Reader für ICON-CH1-EPS / ICON-CH2-EPS Manifest.
 *
 * Phase 1: dieses Modul liest `radar/eps/latest.json` aus R2 (geschrieben
 * von `scripts/ingest_icon_eps.py`). Es wird in Phase 2 von
 * `src/lib/radar.functions.ts` konsumiert, sobald der Frontend-Layer auf
 * EPS-Ensemble-Mean-PNGs umgestellt ist.
 *
 * Solange Phase 2 nicht aktiv ist, ändert dieses Modul nichts am
 * Laufzeitverhalten — es ist nur ein typisierter, gecachter Reader.
 */

export interface EpsStep {
  /** ISO UTC des Forecast-Zeitschritts. */
  t: string;
  /** Horizont in Stunden ab Lauftermin. */
  horizon_h: number;
  /** Akkumulationsfenster in Stunden (typ. 1). */
  interval_h: number;
  /** Anzahl Ensemble-Member, die in Mean/Prob eingegangen sind (typ. 21). */
  members: number;
  /** URL zum gerenderten Ensemble-Mean-PNG (mm/h, gleiche Farbskala wie CPC). */
  meanUrl: string;
  /** URL zum 8-bit-Probability-PNG (0..255 → 0..100 %, P(>0.1 mm/h)). */
  probUrl: string;
  /** URL zum deterministischen Control-Run-PNG (Member 0). Optional bis alle
   *  Runs im R2 mit ingestVersion ≥ v2 geschrieben sind. */
  detUrl?: string;
  /** Max-Wert im Mean-Feld (mm/h). */
  maxMmh: number;
  /** Max-Wert im deterministischen Feld (mm/h). Optional bis v2. */
  detMaxMmh?: number;
  /** Anteil "nasser" Pixel im Mean (> 0.1 mm/h), 0..1. */
  meanWetFrac: number;
}

export interface EpsModelEntry {
  model: "ch1" | "ch2";
  /** ISO UTC des Modelllaufs (reference_datetime). */
  run: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  metaUrl: string;
  steps: EpsStep[];
}

export interface EpsManifest {
  generatedAt: string;
  ingestVersion: string;
  models: Partial<Record<"ch1" | "ch2", EpsModelEntry>>;
}

let cache: { ts: number; data: EpsManifest | null } | null = null;
const TTL_MS = 60_000;

/**
 * Lädt `radar/eps/latest.json` aus R2. Ergebnis wird 60 s in-Memory gecacht.
 * Bei Fehler/Abwesenheit wird `null` zurückgegeben (kein Throw), damit der
 * Aufrufer auf den deterministischen Pfad zurückfallen kann.
 */
export async function getIconEpsManifest(): Promise<EpsManifest | null> {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    console.warn("[eps] R2_PUBLIC_URL not set");
    return null;
  }
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) return cache.data;

  const trimmed = base.replace(/\/+$/, "");
  const origin = trimmed
    .replace(/\/radar\/frames\.json$/i, "")
    .replace(/\/radar\/?$/i, "");
  const url = `${origin}/radar/eps/latest.json`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30 } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[eps] manifest fetch ${url} -> ${res.status}`);
      cache = { ts: now, data: null };
      return null;
    }
    const json = (await res.json()) as EpsManifest;
    const counts = Object.entries(json.models ?? {})
      .map(([m, e]) => `${m}=${e?.steps?.length ?? 0}`)
      .join(" ");
    console.log(`[eps] manifest loaded: ${counts}`);
    cache = { ts: now, data: json };
    return json;
  } catch (e) {
    console.warn(`[eps] manifest fetch error: ${(e as Error).message}`);
    cache = { ts: now, data: null };
    return null;
  }
}
