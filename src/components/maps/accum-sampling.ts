// Monoton begrenzte Catmull-Rom-Abtastung für Niederschlagssummen.
//
// Bikubische Interpolation (Catmull-Rom) überschwingt an Sprüngen: die
// negative Seitenkeule lässt den Wert in Zellenmitte minimal unter die
// Eckwerte sinken. Liegt eine Fläche flächig auf einer Klassenuntergrenze
// (z. B. genau 0.3 mm), wird sie in jeder Zellenmitte knapp transparent —
// sichtbar als ringförmige Löcher und Wabenmuster auf der Karte.
//
// Deshalb wird der interpolierte Wert an den vier Eckwerten der Zelle
// begrenzt: es entstehen keine neuen Extrema, die Kontur bleibt glatt.

export function crWeight(i: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  if (i === -1) return -0.5 * t3 + t2 - 0.5 * t;
  if (i === 0) return 1.5 * t3 - 2.5 * t2 + 1;
  if (i === 1) return -1.5 * t3 + 2 * t2 + 0.5 * t;
  return 0.5 * t3 - 0.5 * t2;
}

const clampIdx = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

/**
 * Bikubischer Wert an (x0+tx, y0+ty), begrenzt auf den Wertebereich der
 * vier Zell-Eckpunkte. `values` ist zeilenweise (y * nLon + x) gespeichert.
 */
export function sampleAccumCell(
  values: number[],
  nLat: number,
  nLon: number,
  y0: number,
  x0: number,
  tx: number,
  ty: number,
): number {
  const corners = [values[y0 * nLon + x0], values[y0 * nLon + x0 + 1], values[(y0 + 1) * nLon + x0], values[(y0 + 1) * nLon + x0 + 1]];
  if (corners.some(v => !Number.isFinite(v) || v < 0)) return NaN;
  const at = (x: number, y: number) =>
    Math.max(0, values[clampIdx(y, nLat - 1) * nLon + clampIdx(x, nLon - 1)] || 0);

  let v = 0;
  for (let j = -1; j <= 2; j++) {
    const wy = crWeight(j, ty);
    if (!wy) continue;
    const yy = y0 + j;
    for (let i = -1; i <= 2; i++) {
      const wx = crWeight(i, tx);
      if (!wx) continue;
      v += wx * wy * at(x0 + i, yy);
    }
  }

  const c00 = at(x0, y0);
  const c01 = at(x0 + 1, y0);
  const c10 = at(x0, y0 + 1);
  const c11 = at(x0 + 1, y0 + 1);
  const lo = Math.min(c00, c01, c10, c11);
  const hi = Math.max(c00, c01, c10, c11);

  return v < lo ? lo : v > hi ? hi : v;
}
