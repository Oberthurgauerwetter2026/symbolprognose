/**
 * Lokale Nacheichung (Residuen-Korrektur) einer Summenfläche mit eigenen
 * Stationen. Rein und getestet: Differenz Station − Fläche am Standort wird
 * mit Gauss-Gewicht (Radius km) eingerechnet; Plausibilitätsschranke Faktor
 * maxFactor gegenüber der Fläche, trockene Fläche (< minGrid) wird nie
 * korrigiert, damit defekte Sensoren keine Flecken erzeugen.
 */
export type BlendStation = { lat: number; lon: number; value: number };

function nearest(arr: number[], v: number) {
  let b = 0;
  for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - v) < Math.abs(arr[b] - v)) b = i;
  return b;
}

export function blendStations(
  values: number[], gridLat: number[], gridLon: number[], stations: BlendStation[],
  opts: { radiusKm?: number; maxFactor?: number; minGrid?: number } = {},
): number[] {
  const R = opts.radiusKm ?? 7, F = opts.maxFactor ?? 2.5, MIN = opts.minGrid ?? 0.3;
  const nLon = gridLon.length;
  const res: { lat: number; lon: number; d: number }[] = [];
  for (const s of stations) {
    if (!Number.isFinite(s.value)) continue;
    const i = nearest(gridLat, s.lat), j = nearest(gridLon, s.lon);
    if (Math.abs(gridLat[i] - s.lat) > 0.1 || Math.abs(gridLon[j] - s.lon) > 0.1) continue;
    const g = values[i * nLon + j];
    if (!(g >= MIN)) continue;
    const target = Math.min(g * F, Math.max(g / F, s.value));
    res.push({ lat: s.lat, lon: s.lon, d: target - g });
  }
  if (!res.length) return values;
  const kLat = 111.2, kLon = 111.2 * Math.cos((gridLat[0] * Math.PI) / 180);
  return values.map((v, idx) => {
    if (!(v >= 0)) return v;
    const la = gridLat[Math.floor(idx / nLon)], lo = gridLon[idx % nLon];
    let ws = 0, c = 0;
    for (const r of res) {
      const dx = (lo - r.lon) * kLon, dy = (la - r.lat) * kLat;
      const d2 = (dx * dx + dy * dy) / (R * R);
      if (d2 > 9) continue;
      const w = Math.exp(-d2);
      ws += w; c += w * r.d;
    }
    return ws ? Math.max(0, v + c / Math.max(1, ws)) : v;
  });
}
