/**
 * Zuordnung Koordinate → Gemeinde-Region und Auswahl der relevantesten
 * Warnung. Client-safe (nur Geometrie aus dem gebündelten region.json).
 */

import type { FeatureCollection, Position } from "geojson";
import regionData from "@/data/region.json";
import { slugifyRegion } from "@/lib/warnings-config";
import type { WarningDTO } from "@/lib/warnings.functions";

const FC = regionData as unknown as FeatureCollection;

interface RegionShape {
  id: string;
  name: string;
  rings: Position[][];
  cLat: number;
  cLon: number;
}

const SHAPES: RegionShape[] = FC.features.flatMap((f) => {
  const name = String((f.properties as { name?: string } | null)?.name ?? "");
  if (!name) return [];
  const g = f.geometry;
  let rings: Position[][] = [];
  if (g.type === "Polygon") rings = g.coordinates as Position[][];
  else if (g.type === "MultiPolygon")
    rings = (g.coordinates as Position[][][]).flatMap((poly) => poly);
  else return [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const r of rings)
    for (const [x, y] of r) {
      sx += x;
      sy += y;
      n++;
    }
  return [
    {
      id: slugifyRegion(name),
      name,
      rings,
      cLat: n ? sy / n : 0,
      cLon: n ? sx / n : 0,
    },
  ];
});

function pointInRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Gemeinde-ID für einen Punkt; Fallback = nächstgelegener Gemeindemittelpunkt (max. ~12 km). */
export function regionIdForPoint(lat: number, lon: number): string | null {
  for (const s of SHAPES) {
    // Erster Ring = Aussenkontur, weitere Ringe = Löcher.
    if (s.rings.length && pointInRing(lon, lat, s.rings[0])) return s.id;
  }
  let best: { id: string; d: number } | null = null;
  for (const s of SHAPES) {
    const dx = (s.cLon - lon) * Math.cos((lat * Math.PI) / 180) * 111.32;
    const dy = (s.cLat - lat) * 110.57;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { id: s.id, d };
  }
  return best && best.d <= 12 ? best.id : null;
}

/** Alle aktiven Warnungen einer Gemeinde, höchste Stufe zuerst. */
export function warningsForRegion(
  warnings: WarningDTO[] | undefined,
  regionId: string | null,
): WarningDTO[] {
  if (!warnings || !regionId) return [];
  return warnings
    .filter((w) => w.regionIds.includes(regionId))
    .sort(
      (a, b) =>
        b.level - a.level ||
        new Date(a.validTo).getTime() - new Date(b.validTo).getTime(),
    );
}

/** Wichtigste Warnung einer Gemeinde. */
export function topWarningFor(
  warnings: WarningDTO[] | undefined,
  regionId: string | null,
): WarningDTO | null {
  return warningsForRegion(warnings, regionId)[0] ?? null;
}
