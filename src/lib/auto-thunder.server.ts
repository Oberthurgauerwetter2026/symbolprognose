/**
 * Automatische Gewitterwarnung aus dem Radar-/Nowcast-Feld.
 *
 * Grundlage sind dieselben ICON-CH1-Viertelstundenwerte, die auch die
 * Radarkarte speist (Open-Meteo-Cache in R2). Für jede Gemeinde wird die
 * maximale Niederschlagsintensität der nächsten Stunden ermittelt; daraus
 * folgen Warnstufe und Gültigkeit. Die Zugbahn ist im Prognosefeld bereits
 * enthalten — zusätzlich wird die Verlagerung des Schwerpunkts geschätzt,
 * um Richtung und Geschwindigkeit im Warntext auszuweisen.
 *
 * Server-only.
 */

import type { Feature, FeatureCollection } from "geojson";
import regionData from "@/data/region.json";
import { slugifyRegion, TEMPLATES, templateImpact, fillTemplate, warningTitle } from "@/lib/warnings-config";
import { getOpenMeteoCache, getRadarRegionMax } from "@/lib/openmeteo-cache.server";
import { adminClient, setWarningRegions } from "@/lib/warnings.server";

const LOOKAHEAD_MS = 3 * 3600_000;
/** Vorlaufzeit: Warnung erscheint erst 30 min vor erwartetem Eintreffen. */
const LEAD_MS = 30 * 60_000;
/** mm/h-Schwellen für Stufe 1/2/3 (konvektive Intensität). */
const THRESHOLDS: [number, number, number] = [8, 15, 30];


type LocMinutely = {
  minutely_15?: { time: string[]; precipitation: (number | null)[] };
};

const REGION_FC = regionData as unknown as FeatureCollection;

function rings(f: Feature): number[][][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates[0]];
  if (g.type === "MultiPolygon") return g.coordinates.map((p) => p[0]);
  return [];
}

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const REGION_POLYS = REGION_FC.features.map((f) => {
  const name = String((f.properties as { name?: string } | null)?.name ?? "");
  const rs = rings(f);
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const r of rs)
    for (const [x, y] of r) {
      minLon = Math.min(minLon, x);
      maxLon = Math.max(maxLon, x);
      minLat = Math.min(minLat, y);
      maxLat = Math.max(maxLat, y);
    }
  return { id: slugifyRegion(name), name, rs, bbox: { minLat, maxLat, minLon, maxLon } };
});

/** Maximaler Abstand für die Nächste-Gemeinde-Zuordnung (km). */
const NEAREST_KM = 3;

function distKm(lat: number, lon: number, ring: number[][]): number {
  let best = Infinity;
  for (const [x, y] of ring) {
    const dy = (y - lat) * 111.32;
    const dx = (x - lon) * 111.32 * Math.cos(lat * (Math.PI / 180));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * Gemeinde eines Gitterpunkts. Liegt der Punkt in keinem Polygon (das
 * Prognosegitter ist grob, ~5–7 km), wird die nächstgelegene Gemeinde
 * innerhalb von `NEAREST_KM` zugeordnet, damit Zellen am Gemeinderand
 * nicht verloren gehen.
 */
function regionOf(lat: number, lon: number): string | null {
  for (const r of REGION_POLYS) {
    if (lat < r.bbox.minLat - 0.01 || lat > r.bbox.maxLat + 0.01) continue;
    if (lon < r.bbox.minLon - 0.015 || lon > r.bbox.maxLon + 0.015) continue;
    for (const ring of r.rs) if (inRing(lon, lat, ring)) return r.id;
  }
  let bestId: string | null = null;
  let bestKm = NEAREST_KM;
  for (const r of REGION_POLYS) {
    if (lat < r.bbox.minLat - 0.06 || lat > r.bbox.maxLat + 0.06) continue;
    if (lon < r.bbox.minLon - 0.09 || lon > r.bbox.maxLon + 0.09) continue;
    for (const ring of r.rs) {
      const d = distKm(lat, lon, ring);
      if (d < bestKm) {
        bestKm = d;
        bestId = r.id;
      }
    }
  }
  return bestId;
}


function compass(deg: number): string {
  const dirs = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
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
  const [cache, regionMax] = await Promise.all([getOpenMeteoCache(), getRadarRegionMax()]);
  const points = cache?.grid?.points ?? [];
  const locs = (cache?.phase1 ?? cache?.phaseB) as LocMinutely[] | undefined;
  const hasForecast = !!locs && locs.length === points.length && points.length > 0;

  /** Gemessene Werte des neuesten Radarbilds (max. 30 min alt). */
  const measuredAgeMin = regionMax?.t
    ? (Date.now() - new Date(regionMax.t).getTime()) / 60_000
    : Infinity;
  const measured = measuredAgeMin <= 30 ? (regionMax?.regions ?? []) : [];

  if (!hasForecast && measured.length === 0) {
    return {
      detected: 0,
      created: 0,
      closed: await closeStale(),
      note: "Nowcast- und Messdaten nicht verfügbar",
    };
  }

  const times = hasForecast
    ? (locs!.find((l) => l.minutely_15?.time?.length)?.minutely_15?.time ?? [])
    : [];
  if (hasForecast && !times.length && measured.length === 0) {
    return { detected: 0, created: 0, closed: await closeStale(), note: "Keine Viertelstundenwerte" };
  }

  const now = Date.now();
  const slots = times
    .map((t, i) => ({ i, ms: new Date(t.endsWith("Z") ? t : `${t}Z`).getTime() }))
    .filter((s) => s.ms >= now - 15 * 60_000 && s.ms <= now + LOOKAHEAD_MS);

  /** Pro Gemeinde: maximale Intensität + Zeitfenster. */
  const perRegion = new Map<
    string,
    { max: number; firstMs: number; lastMs: number; measured: number }
  >();
  /** Schwerpunkte je Slot zur Verlagerungsschätzung. */
  const centroids: { ms: number; lat: number; lon: number; w: number }[] = [];

  const bump = (rid: string, mmh: number, ms: number, isMeasured: boolean) => {
    const cur = perRegion.get(rid);
    if (!cur) {
      perRegion.set(rid, {
        max: mmh,
        firstMs: ms,
        lastMs: ms,
        measured: isMeasured ? mmh : 0,
      });
      return;
    }
    cur.max = Math.max(cur.max, mmh);
    cur.firstMs = Math.min(cur.firstMs, ms);
    cur.lastMs = Math.max(cur.lastMs, ms);
    if (isMeasured) cur.measured = Math.max(cur.measured, mmh);
  };

  // 1) Messung: Zelle ist bereits da → gilt sofort.
  for (const r of measured) {
    const mmh = typeof r.mmh === "number" ? r.mmh : 0;
    if (mmh < THRESHOLDS[0]) continue;
    bump(r.id, mmh, now, true);
  }

  // 2) Prognose: nächste Stunden.
  for (const slot of slots) {
    let sw = 0;
    let sLat = 0;
    let sLon = 0;
    for (let p = 0; p < points.length; p++) {
      const v = locs![p]?.minutely_15?.precipitation?.[slot.i];
      const mmh = typeof v === "number" ? v * 4 : 0; // 15-min-Summe → mm/h
      if (mmh < THRESHOLDS[0]) continue;
      sw += mmh;
      sLat += points[p].lat * mmh;
      sLon += points[p].lon * mmh;
      const rid = regionOf(points[p].lat, points[p].lon);
      if (!rid) continue;
      bump(rid, mmh, slot.ms, false);
    }
    if (sw > 0) centroids.push({ ms: slot.ms, lat: sLat / sw, lon: sLon / sw, w: sw });
  }


  let motion: AutoThunderResult["motion"];
  if (centroids.length >= 2) {
    const a = centroids[0];
    const b = centroids[centroids.length - 1];
    const dtH = (b.ms - a.ms) / 3600_000;
    if (dtH > 0.2) {
      const dy = (b.lat - a.lat) * 111.32;
      const dx = (b.lon - a.lon) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
      const kmh = Math.hypot(dx, dy) / dtH;
      const bearingFrom = (Math.atan2(-dx, -dy) * 180) / Math.PI;
      if (kmh >= 5) motion = { from: compass(bearingFrom), kmh: Math.round(kmh) };
    }
  }

  const sb = await adminClient();
  let created = 0;
  /** Regionen, für die tatsächlich eine Warnung gilt (Vorlauf erreicht). */
  const warnedRegions: string[] = [];

  for (const [regionId, info] of perRegion) {
    const level = levelFor(info.max);
    if (!level) continue;
    const isMeasured = info.measured >= THRESHOLDS[0];
    // Prognosewerte erst 30 min vor erwartetem Eintreffen warnen; gemessene
    // Zellen gelten sofort.
    if (!isMeasured && info.firstMs > now + LEAD_MS) continue;
    warnedRegions.push(regionId);
    const validTo = new Date(Math.max(info.lastMs + 30 * 60_000, now + 45 * 60_000)).toISOString();
    const validFrom = new Date(
      isMeasured ? now : Math.min(Math.max(now, info.firstMs - LEAD_MS), info.firstMs),
    ).toISOString();
    const tpl = TEMPLATES.gewitter[level];

    const base = fillTemplate(tpl.description);
    const motionText = motion
      ? ` Zellen ziehen mit rund ${motion.kmh} km/h aus ${motion.from} heran.`
      : "";
    const intensityText = isMeasured
      ? `Aktuell gemessene Spitzenintensität ${Math.round(info.measured)} mm/h.`
      : `Erwartete Spitzenintensitäten ${Math.round(info.max)} mm/h.`;
    const row = {
      hazard: "gewitter",
      level,
      valid_from: validFrom,
      valid_to: validTo,
      title: warningTitle("gewitter", level),
      description: `${base} ${intensityText}${motionText}`,

      impact: templateImpact(tpl),
      params: { value: String(Math.round(info.max)), auto: true, measured: isMeasured },

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
  const keep = activeRegionIds.map((r) => `auto-gewitter-${r}`);
  const { data } = await sb
    .from("warnings")
    .select("id, auto_key, valid_to")
    .eq("source", "auto")
    .eq("active", true);
  const rows = (data ?? []) as { id: string; auto_key: string | null; valid_to: string }[];
  let closed = 0;
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
