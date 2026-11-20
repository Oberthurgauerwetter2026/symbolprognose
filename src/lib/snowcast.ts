/** Reine Rechenlogik für den Vertikalschnitt (SnowCast). Getestet in snowcast.test.ts. */

export type LatLon = { lat: number; lon: number; name?: string };

export const PRESET_ROUTES: { id: string; label: string; points: LatLon[] }[] = [
  { id: "fwr", label: "Frauenfeld – Weinfelden – Romanshorn", points: [
    { lat: 47.5569, lon: 8.8988, name: "Frauenfeld" }, { lat: 47.5667, lon: 9.1067, name: "Weinfelden" }, { lat: 47.5656, lon: 9.3789, name: "Romanshorn" }] },
  { id: "fwar", label: "Frauenfeld – Weinfelden – Arbon – Rorschach", points: [
    { lat: 47.5569, lon: 8.8988, name: "Frauenfeld" }, { lat: 47.5667, lon: 9.1067, name: "Weinfelden" }, { lat: 47.5167, lon: 9.4333, name: "Arbon" }, { lat: 47.4778, lon: 9.4903, name: "Rorschach" }] },
  { id: "kra", label: "Kreuzlingen – Romanshorn – Arbon", points: [
    { lat: 47.6458, lon: 9.1781, name: "Kreuzlingen" }, { lat: 47.5656, lon: 9.3789, name: "Romanshorn" }, { lat: 47.5167, lon: 9.4333, name: "Arbon" }] },
  { id: "wfb", label: "Winterthur – Frauenfeld – Bodensee", points: [
    { lat: 47.4997, lon: 8.7241, name: "Winterthur" }, { lat: 47.5569, lon: 8.8988, name: "Frauenfeld" }, { lat: 47.5900, lon: 9.3000, name: "Bodensee" }] },
  { id: "alpen", label: "Genfersee – Säntis – Bodensee", points: [
    { lat: 46.4600, lon: 6.8400, name: "Genfersee" }, { lat: 46.9480, lon: 7.4474, name: "Bern" }, { lat: 47.0502, lon: 8.3093, name: "Luzern" }, { lat: 47.2494, lon: 9.3433, name: "Säntis" }, { lat: 47.5167, lon: 9.4333, name: "Arbon" }] },
];

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Sample = LatLon & { km: number };

/** Gleichmässige Stützpunkte entlang der Polylinie (inkl. Endpunkte). */
export function sampleRoute(points: LatLon[], stepKm = 3, maxSamples = 40): Sample[] {
  if (points.length < 2) return points.map((p) => ({ ...p, km: 0 }));
  const segs: number[] = [];
  for (let i = 1; i < points.length; i++) segs.push(haversineKm(points[i - 1]!, points[i]!));
  const total = segs.reduce((a, b) => a + b, 0);
  const n = Math.max(2, Math.min(maxSamples, Math.round(total / stepKm) + 1));
  const out: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    let acc = 0, i = 0;
    while (i < segs.length - 1 && acc + segs[i]! < d) { acc += segs[i]!; i++; }
    const f = segs[i]! > 0 ? Math.min(1, (d - acc) / segs[i]!) : 0;
    const a = points[i]!, b = points[i + 1]!;
    out.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, km: d });
  }
  return out;
}

/** Feuchtkugeltemperatur nach Stull (2011), T in °C, RH in %. */
export function wetBulb(t: number, rh: number): number {
  const r = Math.max(1, Math.min(100, rh));
  return t * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) + Math.atan(t + r) - Math.atan(r - 1.676331)
    + 0.00391838 * r ** 1.5 * Math.atan(0.023101 * r) - 4.686035;
}

/** Ein Profilpunkt: Höhe (m ü. M.) und Wert. */
export type Level = { z: number; t: number; rh: number; ws: number; wd: number };

/** Lineare Interpolation eines Feldes im (aufsteigend sortierten) Profil. */
export function interpAt(levels: Level[], z: number, key: "t" | "rh"): number | null {
  if (!levels.length) return null;
  const first = levels[0]!, last = levels[levels.length - 1]!;
  if (z < first.z || z > last.z) return null;
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1]!, b = levels[i]!;
    if (z <= b.z) { const f = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z); return a[key] + (b[key] - a[key]) * f; }
  }
  return last[key];
}

/**
 * Höchste Höhe, auf der die Grösse `f(level)` von oben kommend den Schwellwert überschreitet.
 * Damit zählt bei Inversionen die oberste Warmschicht (dort schmilzt der Schnee).
 * null = überall unter dem Schwellwert (Schnee bis zum Boden), -Infinity nie gebraucht.
 */
export function crossingFromTop(levels: Level[], f: (l: Level) => number, thr: number): number | null {
  for (let i = levels.length - 1; i > 0; i--) {
    const hi = levels[i]!, lo = levels[i - 1]!;
    const vh = f(hi), vl = f(lo);
    if (vh < thr && vl >= thr) return lo.z + ((thr - vl) / (vh - vl)) * (hi.z - lo.z);
    if (vh >= thr) return hi.z; // schon oben warm
  }
  return null;
}

export type ColumnAnalysis = {
  freezing: number | null; // Nullgradgrenze
  wetBulbZero: number | null; // Feuchtkugel-Nullgradgrenze
  snowLine: number | null; // geschätzte Schneefallgrenze
  snowLow: number | null; snowHigh: number | null; // Unsicherheitsband
  inversion: boolean; // Warmschicht über kälterer Luft
};

/**
 * Schneefallgrenze ≈ Höhe der Feuchtkugeltemperatur +1 °C (dort ist fallender Schnee
 * zum grössten Teil geschmolzen), Band zwischen Tw 0 °C und +1.5 °C. Liegt die ganze
 * Säule darunter, schneit es bis zum Boden (Geländehöhe).
 */
export function analyseColumn(levels: Level[], ground: number): ColumnAnalysis {
  const above = levels.filter((l) => l.z >= ground - 1);
  const tw = (l: Level) => wetBulb(l.t, l.rh);
  const clamp = (z: number | null) => (z === null ? ground : Math.max(ground, z));
  const freezing = crossingFromTop(above, (l) => l.t, 0);
  const wbz = crossingFromTop(above, tw, 0);
  const s1 = crossingFromTop(above, tw, 1);
  const s15 = crossingFromTop(above, tw, 1.5);
  let inversion = false;
  for (let i = 1; i < above.length; i++) if (above[i]!.t > above[i - 1]!.t + 0.3 && above[i]!.t > 0) inversion = true;
  return {
    freezing: clamp(freezing), wetBulbZero: clamp(wbz), snowLine: clamp(s1),
    snowLow: clamp(s15), snowHigh: clamp(wbz), inversion,
  };
}

export const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300] as const;
