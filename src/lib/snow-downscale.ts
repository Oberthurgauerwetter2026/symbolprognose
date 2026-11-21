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

/** Höhenstufen (m) für die stundenweise Schneeprojektion. */
export const SNOW_LEVELS = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 4000];

/**
 * Stundenweise auf das Gelände projizierter Schnee (mm Wasser) je Höhenstufe:
 * jede Stunde mit eigener Schneefallgrenze (Nullgradgrenze − 300 m), danach summiert –
 * wie in der Meteorologie üblich, statt einer über das Fenster gemittelten Grenze.
 * Ergebnis: SNOW_LEVELS.length Werte, oder null bei fehlenden Daten.
 */
export function hourlySnowProfile(
  timesMs: number[], precip: (number | null)[], fzl: (number | null)[] | undefined, nowMs: number, hours: number, future = true,
): number[] | null {
  if (!fzl) return null;
  const start = future ? nowMs : nowMs - hours * 3600_000;
  const end = future ? nowMs + hours * 3600_000 : nowMs;
  const out = SNOW_LEVELS.map(() => 0);
  for (let i = 0; i < timesMs.length; i++) {
    if (timesMs[i] <= start || timesMs[i] > end) continue;
    const p = precip[i], f = fzl[i];
    if (p == null || !Number.isFinite(p) || p < 0) return null;
    if (p === 0) continue;
    if (f == null || !Number.isFinite(f) || f < 0) return null;
    const line = Math.max(0, f - 300);
    for (let k = 0; k < SNOW_LEVELS.length; k++) out[k] += p * snowFraction(SNOW_LEVELS[k], line);
  }
  return out.map((x) => Math.round(x * 10) / 10);
}

function atLevel(profile: number[], elev: number): number {
  const L = SNOW_LEVELS;
  if (elev <= L[0]) return profile[0];
  for (let k = 1; k < L.length; k++) {
    if (elev <= L[k]) {
      const t = (elev - L[k - 1]) / (L[k] - L[k - 1]);
      return profile[k - 1] * (1 - t) + profile[k] * t;
    }
  }
  return profile[L.length - 1];
}

/** Wie downscaleSnow, aber mit stundenweisem Höhenprofil (flach: Punkt × SNOW_LEVELS). */
export function downscaleSnowProfile(
  rain: number[], profile: number[], gridLat: number[], gridLon: number[], dem: Int16Array,
): { gridLat: number[]; gridLon: number[]; values: number[] } {
  const n = SNOW_LEVELS.length;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const lat: number[] = [], lon: number[] = [];
  for (let la = gridLat[0]; la <= gridLat[gridLat.length - 1] + 1e-9; la += 0.01) lat.push(r2(la));
  for (let lo = gridLon[0]; lo <= gridLon[gridLon.length - 1] + 1e-9; lo += 0.01) lon.push(r2(lo));
  const levels = SNOW_LEVELS.map((_, k) => rain.map((_, i) => profile[i * n + k]));
  const values = new Array(lat.length * lon.length).fill(-1);
  const prof = new Array<number>(n);
  for (let i = 0; i < lat.length; i++) {
    const row = Math.round(((DEM.maxLat - lat[i]) / (DEM.maxLat - DEM.minLat)) * (DEM.h - 1));
    for (let j = 0; j < lon.length; j++) {
      const p = bilinear(rain, gridLat, gridLon, lat[i], lon[j]);
      if (p < 0) continue;
      const col = Math.round(((lon[j] - DEM.minLon) / (DEM.maxLon - DEM.minLon)) * (DEM.w - 1));
      if (row < 0 || row >= DEM.h || col < 0 || col >= DEM.w) continue;
      if (p === 0) { values[i * lon.length + j] = 0; continue; }
      let ok = true;
      for (let k = 0; k < n; k++) { prof[k] = bilinear(levels[k], gridLat, gridLon, lat[i], lon[j]); if (prof[k] < 0) { ok = false; break; } }
      if (!ok) continue;
      values[i * lon.length + j] = Math.round(atLevel(prof, dem[row * DEM.w + col]) * CM_PER_MM * 10) / 10;
    }
  }
  return { gridLat: lat, gridLon: lon, values };
}
