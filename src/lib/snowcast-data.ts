/** Holt Modelldaten im Browser direkt bei Open-Meteo (keine geteilten Server-IPs). */
import { PRESSURE_LEVELS, type Level, type Sample } from "./snowcast";

export type Column = { sample: Sample; ground: number; t2: number | null; rh2: number | null; precip: number | null; snow: number | null; levels: Level[] };
export type SectionHour = { time: string; columns: Column[] };
export type SectionData = { hours: SectionHour[]; upperModel: string; surfaceModel: string };

const BASE = "https://api.open-meteo.com/v1/forecast";
const UPPER = ["temperature", "relative_humidity", "geopotential_height", "wind_speed", "wind_direction"];

async function getJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Modelldaten nicht verfügbar (${r.status})`);
  const j = await r.json();
  return (Array.isArray(j) ? j : [j]) as Array<{ hourly: Record<string, (number | null)[]> & { time: string[] } }>;
}

export async function loadSection(samples: Sample[], hours = 48): Promise<SectionData> {
  const lat = samples.map((s) => s.lat.toFixed(4)).join(",");
  const lon = samples.map((s) => s.lon.toFixed(4)).join(",");
  // In zwei Paketen (grosse Anfragen lehnt Open-Meteo ab); temperature_500hPa liefert ICON-D2 dort nicht.
  const vars = PRESSURE_LEVELS.flatMap((p) => UPPER.map((v) => `${v}_${p}hPa`)).filter((v) => v !== "temperature_500hPa");
  const half = Math.ceil(vars.length / 2);
  const common = `latitude=${lat}&longitude=${lon}&forecast_hours=${hours}&timezone=Europe%2FZurich&wind_speed_unit=kmh`;
  const [upper, surf, elev] = await Promise.all([
    Promise.all([vars.slice(0, half), vars.slice(half)].map((v) => getJson(`${BASE}?${common}&models=icon_d2&hourly=${v.join(",")}`)))
      .then(([a, b]) => a!.map((loc, i) => ({ hourly: { ...loc.hourly, ...b![i]!.hourly } }))),
    getJson(`${BASE}?${common}&models=meteoswiss_icon_ch1&hourly=temperature_2m,relative_humidity_2m,precipitation,snowfall`).catch(() => null),
    fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`).then((r) => r.json() as Promise<{ elevation: number[] }>),
  ]);
  const times = upper[0]?.hourly.time ?? [];
  const out: SectionHour[] = times.map((time, h) => ({
    time,
    columns: samples.map((sample, i) => {
      const u = upper[i]!.hourly, s = surf?.[i]?.hourly;
      const ground = elev.elevation[i] ?? 0;
      const levels: Level[] = [];
      for (const p of PRESSURE_LEVELS) {
        const z = u[`geopotential_height_${p}hPa`]?.[h], t = u[`temperature_${p}hPa`]?.[h], rh = u[`relative_humidity_${p}hPa`]?.[h];
        if (z == null || t == null || rh == null || z < ground) continue; // keine unterirdischen Werte
        levels.push({ z, t, rh, ws: u[`wind_speed_${p}hPa`]?.[h] ?? 0, wd: u[`wind_direction_${p}hPa`]?.[h] ?? 0 });
      }
      const t2 = s?.["temperature_2m"]?.[h] ?? null, rh2 = s?.["relative_humidity_2m"]?.[h] ?? null;
      if (t2 != null && rh2 != null) levels.unshift({ z: ground, t: t2, rh: rh2, ws: levels[0]?.ws ?? 0, wd: levels[0]?.wd ?? 0 });
      levels.sort((a, b) => a.z - b.z);
      return { sample, ground, t2, rh2, precip: s?.["precipitation"]?.[h] ?? null, snow: s?.["snowfall"]?.[h] ?? null, levels };
    }),
  }));
  if (!out.length || out.every((h) => h.columns.every((c) => c.levels.length < 3))) throw new Error("Für diese Strecke liefert das Modell keine Höhendaten.");
  return { hours: out, upperModel: "ICON-D2 (DWD, 2,2 km)", surfaceModel: surf ? "ICON-CH1 (MeteoSchweiz, 1 km)" : "–" };
}
