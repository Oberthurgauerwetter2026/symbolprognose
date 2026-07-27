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
import { slugifyRegion, TEMPLATES, fillTemplate, warningTitle } from "@/lib/warnings-config";
import { getOpenMeteoCache } from "@/lib/openmeteo-cache.server";
import { adminClient, setWarningRegions } from "@/lib/warnings.server";

const LOOKAHEAD_MS = 3 * 3600_000;
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

function regionOf(lat: number, lon: number): string | null {
  for (const r of REGION_POLYS) {
    if (lat < r.bbox.minLat - 0.01 || lat > r.bbox.maxLat + 0.01) continue;
    if (lon < r.bbox.minLon - 0.015 || lon > r.bbox.maxLon + 0.015) continue;
    for (const ring of r.rs) if (inRing(lon, lat, ring)) return r.id;
  }
  return null;
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

export async function runAutoThunder(): Promise<AutoThunderResult> {
  const cache = await getOpenMeteoCache();
  const points = cache?.grid?.points ?? [];
  const locs = ((cache?.phase1 ?? cache?.phaseB ?? null) as LocMinutely[] | null) ?? null;
  if (!locs || locs.length !== points.length || points.length === 0) {
    return { detected: 0, created: 0, closed: await closeStale(), note: "Nowcast-Daten nicht verfügbar" };
  }

  const times = locs.find((l) => l.minutely_15?.time?.length)?.minutely_15?.time ?? [];
  if (!times.length) {
    return { detected: 0, created: 0, closed: await closeStale(), note: "Keine Viertelstundenwerte" };
  }

  const now = Date.now();
  const slots = times
    .map((t, i) => ({ i, ms: new Date(t.endsWith("Z") ? t : `${t}Z`).getTime() }))
    .filter((s) => s.ms >= now - 15 * 60_000 && s.ms <= now + LOOKAHEAD_MS);

  /** Pro Gemeinde: maximale Intensität + Zeitfenster. */
  const perRegion = new Map<string, { max: number; firstMs: number; lastMs: number }>();
  /** Schwerpunkte je Slot zur Verlagerungsschätzung. */
  const centroids: { ms: number; lat: number; lon: number; w: number }[] = [];

  for (const slot of slots) {
    let sw = 0;
    let sLat = 0;
    let sLon = 0;
    for (let p = 0; p < points.length; p++) {
      const v = locs[p]?.minutely_15?.precipitation?.[slot.i];
      const mmh = typeof v === "number" ? v * 4 : 0; // 15-min-Summe → mm/h
      if (mmh < THRESHOLDS[0]) continue;
      sw += mmh;
      sLat += points[p].lat * mmh;
      sLon += points[p].lon * mmh;
      const rid = regionOf(points[p].lat, points[p].lon);
      if (!rid) continue;
      const cur = perRegion.get(rid);
      if (!cur) perRegion.set(rid, { max: mmh, firstMs: slot.ms, lastMs: slot.ms });
      else {
        cur.max = Math.max(cur.max, mmh);
        cur.firstMs = Math.min(cur.firstMs, slot.ms);
        cur.lastMs = Math.max(cur.lastMs, slot.ms);
      }
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

  for (const [regionId, info] of perRegion) {
    const level = levelFor(info.max);
    if (!level) continue;
    const validTo = new Date(Math.max(info.lastMs + 30 * 60_000, now + 45 * 60_000)).toISOString();
    const validFrom = new Date(Math.min(info.firstMs, now)).toISOString();
    const tpl = TEMPLATES.gewitter[level];
    const base = fillTemplate(tpl.description);
    const motionText = motion
      ? ` Die Zellen ziehen mit rund ${motion.kmh} km/h aus ${motion.from} heran.`
      : "";
    const row = {
      hazard: "gewitter",
      level,
      valid_from: validFrom,
      valid_to: validTo,
      title: warningTitle("gewitter", level),
      description: `${base} Radar und Nowcast zeigen Spitzenintensitäten um ${Math.round(info.max)} mm/h.${motionText}`,
      impact: tpl.impact,
      params: { value: String(Math.round(info.max)), auto: true },
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

  const closed = await closeStale(Array.from(perRegion.keys()));
  return { detected: perRegion.size, created, closed, motion };
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
