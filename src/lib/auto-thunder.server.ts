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
 * mm/h-Schwellen für Stufe 1/2/3 (20/40/60). Bewusst höher als die
 * MeteoSchweiz-Kriterien, damit die Automatik nicht zu häufig auslöst.
 * Massgebend ist die flächengestützte Intensität (mind. 3 Radar-Pixel),
 * nicht die Spitze eines einzelnen Pixels.
 */
const THRESHOLDS: [number, number, number] = THUNDER_RAIN_MMH;

/** Maximales Alter der Messung, damit sie noch warnt (min). */
const MAX_AGE_MIN = 30;

function compass(deg: number): string {
  const dirs = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
  return dirs[Math.round(((((deg % 360) + 360) % 360) / 45)) % 8];
}

function levelFor(mmh: number): 1 | 2 | 3 | 0 {
  if (mmh >= THRESHOLDS[2]) return 3;
  if (mmh >= THRESHOLDS[1]) return 2;
  if (mmh >= THRESHOLDS[0]) return 1;
  return 0;
}

export interface AutoThunderResult {
  detected: number;
  created: number;
  closed: number;
  motion?: { from: string; kmh: number };
  note?: string;
}

async function runAutoThunderCore(): Promise<AutoThunderResult> {
  const regionMax = await getRadarRegionMax();

  const ageMin = regionMax?.t ? (Date.now() - new Date(regionMax.t).getTime()) / 60_000 : Infinity;
  const measured = ageMin <= MAX_AGE_MIN ? (regionMax?.regions ?? []) : [];

  if (!regionMax || measured.length === 0) {
    return {
      detected: 0,
      created: 0,
      closed: await closeStale(),
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
    if (area < THRESHOLDS[0]) continue;
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
  const warnedRegions: string[] = [];

  for (const [regionId, v] of perRegion) {
    const level = levelFor(v.area);
    if (!level) continue;
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
      auto_key: `auto-gewitter-${regionId}`,
    };

    const { data: existing } = await sb
      .from("warnings")
      .select("id")
      .eq("auto_key", row.auto_key)
      .maybeSingle();

    let id: string | null = (existing as { id: string } | null)?.id ?? null;
    if (id) {
      await sb.from("warnings").update(row).eq("id", id);
    } else {
      const { data: ins } = await sb.from("warnings").insert(row).select("id").single();
      id = (ins as { id: string } | null)?.id ?? null;
      created++;
    }
    if (id) {
      await setWarningRegions(id, [regionId]);
      if (!existing) {
        const { notifyWarning } = await import("@/lib/push.server");
        await notifyWarning(id).catch(() => undefined);
      }
    }
  }

  const closed = await closeStale(warnedRegions);
  return { detected: warnedRegions.length, created, closed, motion };
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
    await recordRun({ detected: 0, created: 0, closed: 0 }, `Fehler: ${msg}`);
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
