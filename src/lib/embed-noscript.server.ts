/**
 * Server-only Helper: baut LokalNoscriptData (statischer JS-freier Fallback
 * für /embed/region-lokal und /embed/lokal) aus dem bestehenden Open-Meteo
 * Aggregations-Cache. Wird im Loader (SSR) aufgerufen, sodass das Embed
 * auch dann sinnvolle Inhalte zeigt, wenn der Client das JS-Bundle nicht
 * laden kann (z. B. ältere Display-Browser, Signage-Player, stale Chunks).
 */
import type { LokalNoscriptData } from "@/components/embeds/lokal-noscript";
import { getAggregatedForecast } from "./forecast-aggregated.functions";

const MAX_HOURLY = 12;
const MAX_DAILY = 7;

function emptyData(name: string): LokalNoscriptData {
  return { locationName: name, hourly: [], daily: [] };
}

function isDayHour(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const h = d.getHours();
  return h >= 6 && h < 20;
}

export async function buildLokalNoscriptData({
  name,
  lat,
  lon,
}: {
  name: string;
  lat: number;
  lon: number;
}): Promise<LokalNoscriptData> {
  try {
    const fc = await getAggregatedForecast({ data: { lat, lon } });
    const h = fc.hourly;
    const d = fc.daily;

    const nowMs = Date.now();
    let startIdx = 0;
    for (let i = 0; i < h.time.length; i++) {
      const t = new Date(h.time[i]).getTime();
      if (Number.isFinite(t) && t >= nowMs) {
        startIdx = i;
        break;
      }
    }

    const num = (a: number[] | undefined, i: number): number | null => {
      const v = a?.[i];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    const hourSunshineRatio = (i: number): number | null => {
      const v = h.sunshine_duration?.[i];
      return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v / 3600)) : null;
    };

    const buildHour = (i: number) => ({
      time: h.time[i],
      temperature: num(h.temperature_2m, i),
      weathercode: num(h.weathercode, i),
      precipitation: num(h.precipitation, i),
      precipProb: num(h.precipitation_probability, i),
      windSpeed: num(h.windspeed_10m, i),
      isDay: isDayHour(h.time[i] ?? ""),
      isSnow: (h.snowfall?.[i] ?? 0) > 0.05,
      cloudLow: num(h.cloud_cover_low, i),
      cloudMid: num(h.cloud_cover_mid, i),
      cloudHigh: num(h.cloud_cover_high, i),
      sunshineRatio: hourSunshineRatio(i),
    });

    const current = h.time.length
      ? {
          time: h.time[startIdx] ?? h.time[0],
          temperature: num(h.temperature_2m, startIdx),
          weathercode: num(h.weathercode, startIdx),
          precipitation: num(h.precipitation, startIdx),
          windSpeed: num(h.windspeed_10m, startIdx),
          windDirection: num(h.winddirection_10m, startIdx),
          isDay: isDayHour(h.time[startIdx] ?? ""),
          isSnow: (h.snowfall?.[startIdx] ?? 0) > 0.05,
          cloudLow: num(h.cloud_cover_low, startIdx),
          cloudMid: num(h.cloud_cover_mid, startIdx),
          cloudHigh: num(h.cloud_cover_high, startIdx),
          sunshineRatio: hourSunshineRatio(startIdx),
        }
      : undefined;

    const hourly: LokalNoscriptData["hourly"] = [];
    for (let i = startIdx; i < Math.min(startIdx + MAX_HOURLY, h.time.length); i++) {
      hourly.push(buildHour(i));
    }

    // Daily-Ableitungen aus dem stündlichen Schnitt für jeden Tag
    const dailyHourSlice = (date: string): number[] => {
      const out: number[] = [];
      for (let i = 0; i < h.time.length; i++) {
        const t = h.time[i] ?? "";
        if (t.slice(0, 10) === date) out.push(i);
      }
      return out;
    };

    const daily: LokalNoscriptData["daily"] = [];
    for (let i = 0; i < Math.min(MAX_DAILY, d.time.length); i++) {
      const date = d.time[i];
      const slice = dailyHourSlice(date);
      let thunderHours = 0;
      let snowSig = false;
      let lowSum = 0;
      let midSum = 0;
      let highSum = 0;
      let layerN = 0;
      for (const idx of slice) {
        const wc = h.weathercode?.[idx];
        if (wc === 95 || wc === 96 || wc === 99) thunderHours++;
        if ((h.snowfall?.[idx] ?? 0) > 0.05) snowSig = true;
        const lo = h.cloud_cover_low?.[idx];
        const mi = h.cloud_cover_mid?.[idx];
        const hi = h.cloud_cover_high?.[idx];
        if (typeof lo === "number" && Number.isFinite(lo)) { lowSum += lo; layerN++; }
        if (typeof mi === "number" && Number.isFinite(mi)) midSum += mi;
        if (typeof hi === "number" && Number.isFinite(hi)) highSum += hi;
      }
      const n = Math.max(1, layerN);

      daily.push({
        date,
        weathercode: num(d.weathercode, i),
        tMin: num(d.temperature_2m_min, i),
        tMax: num(d.temperature_2m_max, i),
        precipSum: num(d.precipitation_sum, i),
        precipProb: num(d.precipitation_probability_max, i),
        precipHours: num(d.precipitation_hours, i),
        thunderHours,
        sunshineRatio:
          typeof d.sunshine_duration?.[i] === "number" && Number.isFinite(d.sunshine_duration[i])
            ? Math.max(0, Math.min(1, d.sunshine_duration[i] / (15 * 3600)))
            : null,
        isSnow: snowSig || (d.snowfall_sum?.[i] ?? 0) > 0.1,
        cloudLow: layerN ? lowSum / n : null,
        cloudMid: layerN ? midSum / n : null,
        cloudHigh: layerN ? highSum / n : null,
        windMax: num(d.windgusts_10m_max, i),
      });
    }

    return {
      locationName: name,
      generatedAt: new Date().toISOString(),
      current,
      hourly,
      daily,
    };
  } catch (err) {
    console.error("[embed-noscript] build failed", err);
    return emptyData(name);
  }
}
