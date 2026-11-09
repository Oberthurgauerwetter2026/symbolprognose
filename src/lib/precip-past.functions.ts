import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createSumsCache } from "./sums-cache";
import { packDeep } from "./sums-pack";
import { PAST_WINDOWS } from "./precip-past";
import { completeWindowSum } from "./sums-coverage";
import { SUM_STATIONS, parseSmnCsv, stationWindowSum, type Sample } from "./station-sums";

export type StationPoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  /** mm je Fenster (null = lückenhaft) */
  rain: Record<string, number | null>;
  /** cm Neuschnee je Fenster (null = keine Schneehöhe gemessen) */
  snow: Record<string, number | null>;
  /** mch = MeteoSchweiz, own = eigene Weather-Hub-Station */
  source: "mch" | "own";
};

export type RadarSums = {
  gridLat: number[];
  gridLon: number[];
  /** mm je Fenster, Index = lat * nLon + lon */
  rain: Record<string, number[]>;
  missingHours: Record<string, number>;
  /** cm Radar-Neuschnee (CombiPrecip × Phase aus DEM/Stationen/Modell) */
  snow?: Record<string, number[]>;
  snowMissingHours?: Record<string, number>;
  t: string;
  source: string;
};

/** Raster über Oberthurgau und Umgebung (Schaffhausen – Bregenz – Säntis). */
const LAT_MIN = 46.9;
const LAT_MAX = 48.1;
const LON_MIN = 8.3;
const LON_MAX = 10.6;
const STEP = 0.15;

export type PastSums = {
  gridLat: number[];
  gridLon: number[];
  /** mm Niederschlag je Fenster, Index = lat * nLon + lon */
  rain: Record<string, number[]>;
  /** cm Neuschnee je Fenster */
  snow: Record<string, number[]>;
  generatedAt: string;
  source: string;
  radar: RadarSums | null;
  stations: StationPoint[];
  /** Prognosesummen ICON-CH1 → CH2 ab jetzt (mm / cm) */
  forecast: { rain: Record<string, number[]>; snow: Record<string, number[]> };
};

async function loadRadarSums(): Promise<RadarSums | null> {
  const { r2ObjectUrlCandidates } = await import("./r2-url.server");
  const urls = [
    ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, "radar/sums/latest.json"),
    ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, "radar/sums/latest.json"),
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        t: string; gridLat: number[]; gridLon: number[]; sums: Record<string, number[]>;
        missingHours: Record<string, number>; source: string;
        snow?: Record<string, number[]>; snowMissingHours?: Record<string, number>;
      };
      // Älter als 3 h → nicht als „aktuell" anzeigen.
      if (Date.now() - Date.parse(j.t) > 3 * 3_600_000) return null;
      const rain: Record<string, number[]> = {};
      for (const [w, arr] of Object.entries(j.sums)) rain[w] = arr.map((v) => v / 10);
      const snow: Record<string, number[]> | undefined = j.snow
        ? Object.fromEntries(Object.entries(j.snow).map(([w, arr]) => [w, arr.map((v) => v / 10)]))
        : undefined;
      return { gridLat: j.gridLat, gridLon: j.gridLon, rain, missingHours: j.missingHours, snow, snowMissingHours: j.snowMissingHours, t: j.t, source: j.source };
    } catch (e) {
      console.warn(`[past-sums] radar ${url}: ${(e as Error).message}`);
    }
  }
  return null;
}

async function loadStations(now: number): Promise<StationPoint[]> {
  const base = "https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn";
  const res = await Promise.all(
    SUM_STATIONS.map(async (st) => {
      const id = st.id.toLowerCase();
      try {
        const [h, t] = await Promise.all([
          fetch(`${base}/${id}/ogd-smn_${id}_h_recent.csv`, { signal: AbortSignal.timeout(6_000) }).then((r) => (r.ok ? r.text() : "")),
          fetch(`${base}/${id}/ogd-smn_${id}_t_now.csv`, { signal: AbortSignal.timeout(6_000) }).then((r) => (r.ok ? r.text() : "")),
        ]);
        const hourly = parseSmnCsv(h, 60);
        const tenMin = parseSmnCsv(t, 10);
        // 10-Min-Daten ersetzen die Stundenwerte ab ihrem ersten Zeitpunkt.
        const cut = tenMin.length ? tenMin[0].t - 600_000 : Infinity;
        const samples: Sample[] = [...hourly.filter((s) => s.t <= cut), ...tenMin];
        const rain: Record<string, number | null> = {};
        const snow: Record<string, number | null> = {};
        for (const w of PAST_WINDOWS) {
          const r = stationWindowSum(samples, now, w);
          rain[w] = r.rain;
          snow[w] = r.snow;
        }
        return { ...st, rain, snow, source: "mch" } as StationPoint;
      } catch (e) {
        console.warn(`[past-sums] station ${st.id}: ${(e as Error).message}`);
        return null;
      }
    }),
  );
  return res.filter((x): x is StationPoint => !!x && Object.values(x.rain).some((v) => v !== null));
}

const cachedSums = createSumsCache<PastSums>(30 * 60_000, 60 * 60_000);

function range(a: number, b: number, s: number) {
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += s) out.push(Math.round(v * 1000) / 1000);
  return out;
}

async function load(): Promise<PastSums> {
  const gridLat = range(LAT_MIN, LAT_MAX, STEP);
  const gridLon = range(LON_MIN, LON_MAX, STEP);
  const pts: [number, number][] = [];
  for (const la of gridLat) for (const lo of gridLon) pts.push([la, lo]);

  type Loc = { hourly?: { time: string[]; precipitation?: (number | null)[]; snowfall?: (number | null)[] } };
  const results: Loc[] = new Array(pts.length);
  const BATCH = 150;
  const batches: Promise<void>[] = [];
  for (let i = 0; i < pts.length; i += BATCH) {
    const slice = pts.slice(i, i + BATCH);
    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      `latitude=${slice.map((p) => p[0]).join(",")}` +
      `&longitude=${slice.map((p) => p[1]).join(",")}` +
      "&hourly=precipitation,snowfall&past_days=3&forecast_days=4&timezone=GMT" +
      "&models=meteoswiss_icon_ch1,meteoswiss_icon_ch2";
    const start = i;
    batches.push(
      (async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) {
          // Modell ist nur Fallback/Schnee: Limit darf Radar + Stationen nicht blockieren.
          console.warn(`[past-sums] Open-Meteo ${res.status}`);
          return;
        }
        const json = await res.json();
        const arr: unknown[] = Array.isArray(json) ? json : [json];
        arr.forEach((loc, k) => {
          const l = loc as { hourly?: Record<string, unknown> };
          const h = l.hourly ?? {};
          // Erstes vorhandenes Modell (CH1 bevorzugt) je Variable nehmen.
          const pick = (v: string) =>
            (h[`${v}_meteoswiss_icon_ch1`] as (number | null)[] | undefined)?.map((x, idx) =>
              x ?? ((h[`${v}_meteoswiss_icon_ch2`] as (number | null)[] | undefined)?.[idx] ?? null),
            ) ?? (h[v] as (number | null)[] | undefined);
          results[start + k] = {
            hourly: { time: (h.time as string[]) ?? [], precipitation: pick("precipitation"), snowfall: pick("snowfall") },
          };
        });
      })(),
    );
  }
  const now = Date.now();
  const { loadOwnStations } = await import("./own-stations.server");
  const [, radar, mchStations, ownStations] = await Promise.all([
    Promise.all(batches.map((b) => b.catch((e) => console.warn(`[past-sums] model: ${(e as Error).message}`)))),
    loadRadarSums().catch(() => null),
    loadStations(now).catch(() => [] as StationPoint[]),
    loadOwnStations(now).catch(() => [] as StationPoint[]),
  ]);
  const stations: StationPoint[] = [...mchStations, ...ownStations];
  // Säntis misst keine Schneehöhe und liegt zwischen den Rasterpunkten:
  // Gipfel-Neuschnee aus ICON-CH1/CH2 am Stationsort ergänzen.
  const sae = stations.find((s) => s.id === "SAE");
  if (sae && PAST_WINDOWS.every((w) => sae.snow[w] === null)) {
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${sae.lat}&longitude=${sae.lon}&elevation=${sae.alt}&hourly=snowfall&past_days=3&forecast_days=1&timezone=GMT&models=meteoswiss_icon_ch1,meteoswiss_icon_ch2`,
        { signal: AbortSignal.timeout(6_000) },
      );
      if (r.ok) {
        const j = (await r.json()) as { hourly: Record<string, (number | null)[] | string[]> };
        const t = (j.hourly.time as string[]).map((x) => Date.parse(x + "Z"));
        const a = j.hourly.snowfall_meteoswiss_icon_ch1 as (number | null)[];
        const b = j.hourly.snowfall_meteoswiss_icon_ch2 as (number | null)[];
        const v = a.map((x, i) => x ?? b?.[i] ?? null);
        for (const w of PAST_WINDOWS) {
          const s = completeWindowSum(t, v, now, w, false);
          sae.snow[w] = s >= 0 ? Math.round(s * 10) / 10 : null;
        }
      }
    } catch (e) {
      console.warn(`[past-sums] Säntis-Schnee: ${(e as Error).message}`);
    }
  }
  const rain: Record<string, number[]> = {};
  const snow: Record<string, number[]> = {};
  const fRain: Record<string, number[]> = {};
  const fSnow: Record<string, number[]> = {};
  for (const w of PAST_WINDOWS) {
    rain[w] = new Array(pts.length).fill(-1);
    snow[w] = new Array(pts.length).fill(-1);
    fRain[w] = new Array(pts.length).fill(-1);
    fSnow[w] = new Array(pts.length).fill(-1);
  }
  for (let i = 0; i < pts.length; i++) {
    const h = results[i]?.hourly;
    if (!h) continue;
    const times = h.time.map((t) => Date.parse(t + "Z"));
    for (const w of PAST_WINDOWS) {
      rain[w][i] = completeWindowSum(times, h.precipitation ?? [], now, w, false);
      snow[w][i] = completeWindowSum(times, h.snowfall ?? [], now, w, false);
      fRain[w][i] = completeWindowSum(times, h.precipitation ?? [], now, w, true);
      fSnow[w][i] = completeWindowSum(times, h.snowfall ?? [], now, w, true);
    }
  }
  return {
    gridLat,
    gridLon,
    rain,
    snow,
    generatedAt: new Date(now).toISOString(),
    source: "MeteoSchweiz ICON-CH1/CH2 Analyse via Open-Meteo",
    radar,
    stations,
    forecast: { rain: fRain, snow: fSnow },
  };
}

export const getPastPrecipSums = createServerFn({ method: "GET" }).handler(async () => {
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    const { useRequest } = await import("nitro/context");
    const request = useRequest();
    if (request.waitUntil) waitUntil = request.waitUntil.bind(request);
  } catch {
    // Other runtimes await refresh rather than abandon background work.
  }
  setResponseHeader("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=1800");
  // Kompakt übertragen (Base64-Int16), Client entpackt in pastPrecipQuery.
  return { packed: JSON.stringify(packDeep(await cachedSums(load, Date.now(), waitUntil))) };
});
