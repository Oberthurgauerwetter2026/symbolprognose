/** Topografischer Modell-Neuschnee: grobe Modellsumme + Schneefallgrenze
 *  werden auf das 0.01°-Geländeraster (DEM, Zeile 0 = Norden) übertragen. */
export const DEM = { minLon: 7.4, maxLon: 11.6, minLat: 46.6, maxLat: 48.6, w: 420, h: 200 };
/** cm Neuschnee je mm Niederschlag (wie Open-Meteo, ~7:1). */
export const CM_PER_MM = 0.7;
/** Übergangsband Regen→Schnee um die Schneefallgrenze (m). */
export const SNOW_BAND_M = 300;

export function snowFraction(elev: number, snowLine: number): number {
  return Math.max(0, Math.min(1, (elev - snowLine) / SNOW_BAND_M + 0.5));
}

function bilinear(v: number[], lat: number[], lon: number[], la: number, lo: number): number {
  const nLon = lon.length;
  const fy = ((la - lat[0]) / (lat[lat.length - 1] - lat[0])) * (lat.length - 1);
  const fx = ((lo - lon[0]) / (lon[nLon - 1] - lon[0])) * (nLon - 1);
  const y0 = Math.max(0, Math.min(lat.length - 2, Math.floor(fy)));
  const x0 = Math.max(0, Math.min(nLon - 2, Math.floor(fx)));
  const ty = Math.max(0, Math.min(1, fy - y0)), tx = Math.max(0, Math.min(1, fx - x0));
  const c = [v[y0 * nLon + x0], v[y0 * nLon + x0 + 1], v[(y0 + 1) * nLon + x0], v[(y0 + 1) * nLon + x0 + 1]];
  if (c.some((x) => !(x >= 0))) return -1;
  return (c[0] * (1 - tx) + c[1] * tx) * (1 - ty) + (c[2] * (1 - tx) + c[3] * tx) * ty;
}

/** rain: mm, snowLineHm: Schneefallgrenze in Hektometern (−1 = kein Niederschlag). */
export function downscaleSnow(
  rain: number[], snowLineHm: number[], gridLat: number[], gridLon: number[], dem: Int16Array,
): { gridLat: number[]; gridLon: number[]; values: number[] } {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const lat: number[] = [], lon: number[] = [];
  for (let la = gridLat[0]; la <= gridLat[gridLat.length - 1] + 1e-9; la += 0.01) lat.push(r2(la));
  for (let lo = gridLon[0]; lo <= gridLon[gridLon.length - 1] + 1e-9; lo += 0.01) lon.push(r2(lo));
  // Trockene Punkte brauchen keine Grenze; nasse Punkte ohne bekannte Grenze
  // bleiben fehlend, statt durch eine erfundene Grenze von 0 m Schnee zu erzeugen.
  const sl = snowLineHm.map((x, i) => (x >= 0 ? x * 100 : rain[i] === 0 ? 0 : -1));
  const values = new Array(lat.length * lon.length).fill(-1);
  for (let i = 0; i < lat.length; i++) {
    const row = Math.round(((DEM.maxLat - lat[i]) / (DEM.maxLat - DEM.minLat)) * (DEM.h - 1));
    for (let j = 0; j < lon.length; j++) {
      const p = bilinear(rain, gridLat, gridLon, lat[i], lon[j]);
      if (p < 0) continue;
      const col = Math.round(((lon[j] - DEM.minLon) / (DEM.maxLon - DEM.minLon)) * (DEM.w - 1));
      if (row < 0 || row >= DEM.h || col < 0 || col >= DEM.w) continue;
      const L = bilinear(sl, gridLat, gridLon, lat[i], lon[j]);
      if (p > 0 && L < 0) continue;
      values[i * lon.length + j] = p > 0 ? Math.round(p * snowFraction(dem[row * DEM.w + col], L) * CM_PER_MM * 10) / 10 : 0;
    }
  }
  return { gridLat: lat, gridLon: lon, values };
}

/** Niederschlagsgewichtete Schneefallgrenze (Nullgradgrenze − 300 m) im Fenster, in hm. */
export function weightedSnowLineHm(
  timesMs: number[], precip: (number | null)[], fzl: (number | null)[] | undefined, nowMs: number, hours: number, future = true,
): number {
  if (!fzl) return -1;
  const start = future ? nowMs : nowMs - hours * 3600_000;
  const end = future ? nowMs + hours * 3600_000 : nowMs;
  let s = 0, w = 0;
  for (let i = 0; i < timesMs.length; i++) {
    if (timesMs[i] <= start || timesMs[i] > end) continue;
    const p = precip[i], f = fzl[i];
    if (p == null || !Number.isFinite(p) || p < 0) return -1;
    if (p === 0) continue;
    if (f == null || !Number.isFinite(f) || f < 0) return -1;
    s += p * Math.max(0, f - 300); w += p;
  }
  return w > 0 ? Math.round(s / w / 10) / 10 : -1;
}
