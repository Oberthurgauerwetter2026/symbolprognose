import { createServerFn } from "@tanstack/react-start";
import { PAST_WINDOWS, sumPastHours } from "./precip-past";

/** Raster über Oberthurgau und Umgebung (Schaffhausen – Bregenz – Säntis). */
const LAT_MIN = 47.15;
const LAT_MAX = 47.85;
const LON_MIN = 8.6;
const LON_MAX = 9.8;
const STEP = 0.05;

export type PastSums = {
  gridLat: number[];
  gridLon: number[];
  /** mm Niederschlag je Fenster, Index = lat * nLon + lon */
  rain: Record<string, number[]>;
  /** cm Neuschnee je Fenster */
  snow: Record<string, number[]>;
  generatedAt: string;
  source: string;
};

let cache: { at: number; value: PastSums } | null = null;
let inflight: Promise<PastSums> | null = null;
const TTL = 30 * 60_000;

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
  const BATCH = 100;
  const batches: Promise<void>[] = [];
  for (let i = 0; i < pts.length; i += BATCH) {
    const slice = pts.slice(i, i + BATCH);
    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      `latitude=${slice.map((p) => p[0]).join(",")}` +
      `&longitude=${slice.map((p) => p[1]).join(",")}` +
      "&hourly=precipitation,snowfall&past_days=3&forecast_days=1&timezone=GMT" +
      "&models=meteoswiss_icon_ch1,meteoswiss_icon_ch2";
    const start = i;
    batches.push(
      (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
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
  await Promise.all(batches);

  const now = Date.now();
  const rain: Record<string, number[]> = {};
  const snow: Record<string, number[]> = {};
  for (const w of PAST_WINDOWS) {
    rain[w] = new Array(pts.length).fill(0);
    snow[w] = new Array(pts.length).fill(0);
  }
  for (let i = 0; i < pts.length; i++) {
    const h = results[i]?.hourly;
    if (!h) continue;
    const times = h.time.map((t) => Date.parse(t + "Z"));
    for (const w of PAST_WINDOWS) {
      rain[w][i] = sumPastHours(times, h.precipitation ?? [], now, w);
      snow[w][i] = sumPastHours(times, h.snowfall ?? [], now, w);
    }
  }
  return {
    gridLat,
    gridLon,
    rain,
    snow,
    generatedAt: new Date(now).toISOString(),
    source: "MeteoSchweiz ICON-CH1/CH2 Analyse via Open-Meteo",
  };
}

export const getPastPrecipSums = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  if (!inflight) {
    inflight = load()
      .then((v) => {
        cache = { at: Date.now(), value: v };
        return v;
      })
      .catch((e) => {
        if (cache) return cache.value;
        throw e;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
});
