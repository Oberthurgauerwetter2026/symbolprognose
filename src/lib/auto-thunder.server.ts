/**
 * Automatische Gewitterwarnung aus der Radarmessung.
 *
 * Grundlage ist ausschliesslich das gemessene MCH-Radarfeld: der Radar-Ingest
 * schreibt alle 5 Minuten je Gemeinde die gemessene Spitzenintensität nach R2
 * (`radar/region-max.json`). Modellprognosen lösen keine Warnungen aus.
 * Die Verlagerung (Richtung/Geschwindigkeit) wird aus dem Schwerpunkt der
 * gemessenen Zellen zweier aufeinanderfolgender Radarbilder geschätzt.
 *
 * Server-only.
 */

import { TEMPLATES, templateImpact, fillTemplate, warningTitle } from "@/lib/warnings-config";
import { getRadarRegionMax } from "@/lib/openmeteo-cache.server";
import { adminClient, setWarningRegions } from "@/lib/warnings.server";

/** mm/h-Schwellen für Stufe 1/2/3 (konvektive Intensität). */
const THRESHOLDS: [number, number, number] = [8, 15, 30];
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

  /** Pro Gemeinde: gemessene Spitzenintensität. */
  const perRegion = new Map<string, number>();
  for (const r of measured) {
    const mmh = typeof r.mmh === "number" ? r.mmh : 0;
    if (mmh < THRESHOLDS[0]) continue;
    perRegion.set(r.id, Math.max(perRegion.get(r.id) ?? 0, mmh));
  }

  // Verlagerung aus zwei aufeinanderfolgenden Radarbildern.
  let motion: AutoThunderResult["motion"];
  const a = regionMax.prev?.centroid;
  const b = regionMax.centroid;
  if (a && b && regionMax.prev?.t) {
    const dtH = (new Date(regionMax.t).getTime() - new Date(regionMax.prev.t).getTime()) / 3600_000;
    if (dtH > 0.02) {
      const dy = (b.lat - a.lat) * 111.32;
      const dx = (b.lon - a.lon) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
      const kmh = Math.hypot(dx, dy) / dtH;
      const bearingFrom = (Math.atan2(-dx, -dy) * 180) / Math.PI;
      if (kmh >= 5 && kmh < 120) motion = { from: compass(bearingFrom), kmh: Math.round(kmh) };
    }
  }

  const sb = await adminClient();
  let created = 0;
  const warnedRegions: string[] = [];

  for (const [regionId, mmh] of perRegion) {
    const level = levelFor(mmh);
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
      description: `${base} Aktuell gemessene Spitzenintensität ${Math.round(mmh)} mm/h.${motionText}`,
      impact: templateImpact(tpl),
      params: { value: String(Math.round(mmh)), auto: true, measured: true },
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
