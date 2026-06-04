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

    // Erste Stunde >= jetzt suchen (Open-Meteo liefert Zeitreihe ab Tagesstart).
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

    const current = h.time.length
      ? {
          time: h.time[startIdx] ?? h.time[0],
          temperature: num(h.temperature_2m, startIdx),
          weathercode: num(h.weathercode, startIdx),
          precipitation: num(h.precipitation, startIdx),
          windSpeed: num(h.windspeed_10m, startIdx),
          windDirection: num(h.winddirection_10m, startIdx),
        }
      : undefined;

    const hourly: LokalNoscriptData["hourly"] = [];
    for (
      let i = startIdx;
      i < Math.min(startIdx + MAX_HOURLY, h.time.length);
      i++
    ) {
      hourly.push({
        time: h.time[i],
        temperature: num(h.temperature_2m, i),
        weathercode: num(h.weathercode, i),
        precipitation: num(h.precipitation, i),
        windSpeed: num(h.windspeed_10m, i),
      });
    }

    const daily: LokalNoscriptData["daily"] = [];
    for (let i = 0; i < Math.min(MAX_DAILY, d.time.length); i++) {
      daily.push({
        date: d.time[i],
        weathercode: num(d.weathercode, i),
        tMin: num(d.temperature_2m_min, i),
        tMax: num(d.temperature_2m_max, i),
        precipSum: num(d.precipitation_sum, i),
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
