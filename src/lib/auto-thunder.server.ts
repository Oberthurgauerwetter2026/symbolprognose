/**
 * Automatische Gewitterwarnung aus der Radarmessung.
 *
 * Grundlage ist ausschliesslich das gemessene MCH-Radarfeld: der Radar-Ingest
 * schreibt alle 5 Minuten je Gemeinde die gemessene Spitzenintensität nach R2
 * (`radar/region-max.json`). Modellprognosen lösen keine Warnungen aus.
 * Die Verlagerung (Richtung/Geschwindigkeit) schätzt der Ingest per
 * Musterabgleich der beiden letzten Radarbilder im Oberthurgau-Fenster.

 *
 * Server-only.
 */

import {
  TEMPLATES,
  templateImpact,
  fillTemplate,
  warningTitle,
  THUNDER_RAIN_MMH,
} from "@/lib/warnings-config";
import { getRadarRegionMax } from "@/lib/openmeteo-cache.server";
import { adminClient, setWarningRegions } from "@/lib/warnings.server";

/**
 * mm/h-Schwellen für Stufe 1/2/3 (15/30/50) gemäss MeteoSchweiz-Gefahrenstufen.
 * MeteoSchweiz (und damit auch SRF Meteo) warnt Gewitter erst ab Stufe 2;
 * Stufe 1 dient nur manuellen Warnungen. Massgebend ist die flächengestützte
 * Intensität (mind. `MIN_CELL_PIXELS` Radar-Pixel), nicht eine Pixelspitze.
 */
const THRESHOLDS: [number, number, number] = THUNDER_RAIN_MMH;

/** Automatik warnt erst ab dieser Stufe (MeteoSchweiz-Praxis: ab Stufe 2). */
const AUTO_MIN_LEVEL = 2;

/** Maximales Alter der Messung, damit sie noch warnt (min). */
const MAX_AGE_MIN = 30;

/**
 * Persistenz: Bestätigung durch aufeinanderfolgende Läufe innerhalb dieses
 * Fensters. Stufe 2 braucht 2 Läufe, Stufe 3 deren 3 (~15 Min.).
 */
const CONFIRM_WINDOW_MS = 15 * 60_000;

/** Nötige Läufe in Folge je Stufe. */
function runsNeeded(level: number): number {
  return level >= 3 ? 3 : 2;
}

/** Zustandszeile für die Kandidaten des letzten Laufs (kein Warnlauf-Protokoll). */
const CAND_JOB = "auto-thunder-candidates";

type Candidates = Record<string, { level: number; t: number; n?: number }>;


async function loadCandidates(): Promise<Candidates> {
  try {
    const sb = await adminClient();
    const { data } = await sb.from("job_runs").select("note").eq("job", CAND_JOB).maybeSingle();
    const note = (data as { note: string | null } | null)?.note;
    if (!note) return {};
    const parsed = JSON.parse(note) as Candidates;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCandidates(c: Candidates): Promise<void> {
  try {
    const sb = await adminClient();
    await sb
      .from("job_runs")
      .upsert(
        { job: CAND_JOB, ran_at: new Date().toISOString(), note: JSON.stringify(c) },
        { onConflict: "job" },
      );
  } catch {
    // Ohne Zustandszeile greift die Bestätigung im nächsten Lauf erneut.
  }
}

function compass(deg: number): string {
  const dirs = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
  return dirs[Math.round(((((deg % 360) + 360) % 360) / 45)) % 8];
}

/** Stufe aus der Flächenintensität; unter Stufe 2 warnt die Automatik nicht. */
function levelFor(mmh: number): 2 | 3 | 0 {
  if (mmh >= THRESHOLDS[2]) return 3;
  if (mmh >= THRESHOLDS[1]) return 2;
  return 0;
}

export interface AutoThunderResult {
  detected: number;
  created: number;
  closed: number;
  /** Anzahl verschickter Push-Meldungen in diesem Lauf. */
  notified: number;
  motion?: { from: string; kmh: number };
  note?: string;
}

/** Wiederholsperre: pro Warnung höchstens alle 60 Minuten eine Push-Meldung. */
const RENOTIFY_MS = 60 * 60_000;



async function runAutoThunderCore(): Promise<AutoThunderResult> {
  const regionMax = await getRadarRegionMax();

  const ageMin = regionMax?.t ? (Date.now() - new Date(regionMax.t).getTime()) / 60_000 : Infinity;
  const measured = ageMin <= MAX_AGE_MIN ? (regionMax?.regions ?? []) : [];

  if (!regionMax || measured.length === 0) {
    return {
      detected: 0,
      created: 0,
      closed: await closeStale(),
      notified: 0,
      note: "Radarmessung nicht verfügbar",
    };

  }

  const now = Date.now();

  /**
   * Pro Gemeinde: Spitzenintensität (`peak`, für den Warntext) und die
   * flächengestützte Intensität (`area`, entscheidet über die Stufe). Fehlt
   * `mmhArea` (alter Ingest-Stand), gilt die Spitze als Rückfall.
   */
  const perRegion = new Map<string, { peak: number; area: number }>();
  for (const r of measured) {
    const peak = typeof r.mmh === "number" ? r.mmh : 0;
    const area = typeof r.mmhArea === "number" ? r.mmhArea : peak;
    // Unter der Stufe-2-Schwelle warnt die Automatik nicht (MeteoSchweiz-Praxis).
    if (area < THRESHOLDS[AUTO_MIN_LEVEL - 1]) continue;

    const prev = perRegion.get(r.id);
    perRegion.set(r.id, {
      peak: Math.max(prev?.peak ?? 0, peak),
      area: Math.max(prev?.area ?? 0, area),
    });
  }

  // Verlagerung: der Radar-Ingest schätzt sie per Musterabgleich der beiden
  // letzten Radarbilder. Fehlt die Angabe, entfällt der Zugbahn-Satz.
  let motion: AutoThunderResult["motion"];
  const m = regionMax.motion;
  if (m && typeof m.kmh === "number" && typeof m.dirFromDeg === "number") {
    if (m.kmh >= 5 && m.kmh < 120) motion = { from: compass(m.dirFromDeg), kmh: Math.round(m.kmh) };
  }


  const sb = await adminClient();
  let created = 0;
  let notified = 0;
  const warnedRegions: string[] = [];

  /**
   * Persistenz-Prüfung: Kandidaten der vorangehenden Läufe. Eine neue Warnung
   * (und jede Höherstufung) braucht mehrere Läufe in Folge über der Schwelle —
   * Stufe 2 zwei Läufe, Stufe 3 drei Läufe.
   */
  const prevCands = await loadCandidates();
  const nextCands: Candidates = {};
  let pending = 0;

  for (const [regionId, v] of perRegion) {
    const rawLevel = levelFor(v.area);
    if (!rawLevel) continue;

    const conf = prevCands[regionId];
    const inWindow = !!conf && now - conf.t <= CONFIRM_WINDOW_MS;
    // Läufe in Folge: bei gleicher oder höherer Stufe weiterzählen.
    const prevRuns = inWindow && conf!.level >= rawLevel ? (conf!.n ?? 1) : 0;
    const runs = prevRuns + 1;
    nextCands[regionId] = { level: rawLevel, t: now, n: runs };

    const confirmed = runs >= runsNeeded(rawLevel);

    const autoKey = `auto-gewitter-${regionId}`;
    const { data: existingData } = await sb
      .from("warnings")
      .select("id, active, level, notified_at")
      .eq("auto_key", autoKey)
      .maybeSingle();
    const existing = existingData as
      | { id: string; active: boolean; level: number; notified_at: string | null }
      | null;
    const running = existing?.active === true;

    // Ohne Bestätigung: eine laufende Warnung wird weitergeführt (ohne
    // Höherstufung), eine neue entsteht noch nicht.
    if (!running && !confirmed) {
      pending++;
      continue;
    }
    const level: 2 | 3 =
      running && !confirmed
        ? (Math.max(AUTO_MIN_LEVEL, Math.min(rawLevel, existing!.level)) as 2 | 3)
        : rawLevel;


    warnedRegions.push(regionId);

    const validFrom = new Date(now).toISOString();
    const validTo = new Date(now + 45 * 60_000).toISOString();
    const tpl = TEMPLATES.gewitter[level];

    const base = fillTemplate(tpl.description);
    const motionText = motion
      ? ` Zellen ziehen mit rund ${motion.kmh} km/h aus ${motion.from} heran.`
      : "";
    const row = {
      hazard: "gewitter",
      level,
      valid_from: validFrom,
      valid_to: validTo,
      title: warningTitle("gewitter", level),
      description: `${base} Aktuell gemessene Spitzenintensität ${Math.round(v.peak)} mm/h.${motionText}`,
      impact: templateImpact(tpl),
      params: { value: String(Math.round(v.peak)), auto: true, measured: true },
      active: true,
      source: "auto",
      auto_key: autoKey,
    };

    let id: string | null = existing?.id ?? null;
    if (id) {
      await sb.from("warnings").update(row).eq("id", id);
    } else {
      const { data: ins } = await sb.from("warnings").insert(row).select("id").single();
      id = (ins as { id: string } | null)?.id ?? null;
      created++;
    }
    if (!id) continue;
    await setWarningRegions(id, [regionId]);

    /**
     * Push nur bei einem neuen Warnereignis:
     * - Warnung neu angelegt
     * - Zeile war vorher inaktiv (Reaktivierung = neues Gewitter)
     * - Warnstufe steigt gegenüber der laufenden Warnung
     * Reine Text-/Zeit-Aktualisierungen im 5-Minuten-Takt lösen keinen Push aus.
     * Zusätzliche Wiederholsperre von 45 Minuten, ausser die Stufe steigt.
     */
    const escalated = !!existing && level > existing.level;
    const reactivated = !!existing && existing.active === false;
    const lastNotifiedMs = existing?.notified_at ? Date.parse(existing.notified_at) : NaN;
    const withinCooldown =
      Number.isFinite(lastNotifiedMs) && now - lastNotifiedMs < RENOTIFY_MS;
    const shouldNotify =
      !existing || escalated || (reactivated && !withinCooldown);

    if (shouldNotify) {
      const { notifyWarning } = await import("@/lib/push.server");
      const sent = await notifyWarning(id).catch(() => 0);
      if (sent > 0) notified += sent;
      await sb
        .from("warnings")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", id);
    }
  }

  await saveCandidates(nextCands);
  const closed = await closeStale(warnedRegions);
  return {
    detected: warnedRegions.length,
    created,
    closed,
    notified,
    motion,
    note: pending > 0 ? `${pending} Zelle(n) warten auf Bestätigung` : undefined,
  };

}

/** Letzten Lauf protokollieren, damit der Admin den Status sieht. */
async function recordRun(r: AutoThunderResult, error?: string): Promise<void> {
  try {
    const sb = await adminClient();
    await sb.from("job_runs").upsert(
      {
        job: "auto-thunder",
        ran_at: new Date().toISOString(),
        detected: r.detected,
        created: r.created,
        closed: r.closed,
        notified: r.notified,
        note: error ?? r.note ?? null,

      },
      { onConflict: "job" },
    );
  } catch {
    // Protokoll ist optional — Lauf nie daran scheitern lassen.
  }
}

/**
 * Öffentlicher Einstiegspunkt: führt die Erkennung aus und protokolliert
 * den Lauf (auch im Fehlerfall) in `public.job_runs`.
 */
export async function runAutoThunder(): Promise<AutoThunderResult> {
  try {
    const res = await runAutoThunderCore();
    await recordRun(res);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unbekannter Fehler";
    await recordRun({ detected: 0, created: 0, closed: 0, notified: 0 }, `Fehler: ${msg}`);
    throw err;
  }
}

/** Automatische Warnungen deaktivieren, die nicht mehr erkannt werden oder abgelaufen sind. */
async function closeStale(activeRegionIds: string[] = []): Promise<number> {
  const sb = await adminClient();
  // Zuerst alle abgelaufenen Warnungen (auch manuell erfasste) beenden.
  const { deactivateExpired } = await import("@/lib/warnings.server");
  let closed = await deactivateExpired();
  const keep = activeRegionIds.map((r) => `auto-gewitter-${r}`);
  const { data } = await sb
    .from("warnings")
    .select("id, auto_key, valid_to")
    .eq("source", "auto")
    .eq("active", true);
  const rows = (data ?? []) as { id: string; auto_key: string | null; valid_to: string }[];
  
  for (const r of rows) {
    const expired = new Date(r.valid_to).getTime() < Date.now();
    const gone = r.auto_key ? !keep.includes(r.auto_key) : true;
    if (expired || gone) {
      await sb.from("warnings").update({ active: false }).eq("id", r.id);
      closed++;
    }
  }
  return closed;
}
