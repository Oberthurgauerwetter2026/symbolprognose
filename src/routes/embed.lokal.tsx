import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EmbedShell } from "@/components/embed-shell";

import { WeatherWidget } from "@/components/weather-widget";
import { LokalNoscript, type LokalNoscriptData } from "@/components/embeds/lokal-noscript";
import { getMultiModelForecast } from "@/lib/forecast.functions";

const AMRISWIL = { name: "Amriswil", lat: 47.5469, lon: 9.2986 };

const searchSchema = z.object({
  day: fallback(z.number().int().min(0).max(6).optional(), undefined).optional(),
});

function buildNoscript(
  fc: Awaited<ReturnType<typeof getMultiModelForecast>>,
): LokalNoscriptData {
  const h = fc?.hourly ?? {};
  const d = fc?.daily ?? {};
  const times = (h.time as string[] | undefined) ?? [];
  const now = Date.now();

  // Index der aktuellen Stunde (jüngster Eintrag <= now).
  let curIdx = -1;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (Number.isFinite(t) && t <= now) curIdx = i;
    else break;
  }
  if (curIdx < 0) curIdx = 0;

  const pickNum = (arr: unknown, i: number): number | null => {
    if (!Array.isArray(arr)) return null;
    const v = arr[i];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const current = times[curIdx]
    ? {
        time: times[curIdx],
        temperature: pickNum(h.temperature_2m, curIdx),
        weathercode: pickNum(h.weathercode, curIdx),
        precipitation: pickNum(h.precipitation, curIdx),
        windSpeed: pickNum(h.wind_speed_10m, curIdx),
        windDirection: pickNum(h.wind_direction_10m, curIdx),
      }
    : undefined;

  const hourly: LokalNoscriptData["hourly"] = [];
  const startH = Math.max(curIdx, 0);
  for (let i = startH; i < Math.min(startH + 12, times.length); i++) {
    hourly.push({
      time: times[i],
      temperature: pickNum(h.temperature_2m, i),
      weathercode: pickNum(h.weathercode, i),
      precipitation: pickNum(h.precipitation, i),
      windSpeed: pickNum(h.wind_speed_10m, i),
    });
  }

  const dTimes = (d.time as string[] | undefined) ?? [];
  const daily: LokalNoscriptData["daily"] = dTimes.slice(0, 7).map((date, i) => ({
    date,
    weathercode: pickNum(d.weathercode, i),
    tMin: pickNum(d.temperature_2m_min, i),
    tMax: pickNum(d.temperature_2m_max, i),
    precipSum: pickNum(d.precipitation_sum, i),
    windMax: pickNum(d.wind_gusts_10m_max, i),
  }));

  return {
    locationName: AMRISWIL.name,
    generatedAt: fc?.generatedAt,
    current,
    hourly,
    daily,
  };
}

export const Route = createFileRoute("/embed/lokal")({
  component: EmbedLokal,
  validateSearch: zodValidator(searchSchema),
  loader: async () => {
    try {
      const fc = await getMultiModelForecast({
        data: { lat: AMRISWIL.lat, lon: AMRISWIL.lon },
      });
      return { noscript: buildNoscript(fc) };
    } catch {
      return {
        noscript: {
          locationName: AMRISWIL.name,
          hourly: [],
          daily: [],
        } satisfies LokalNoscriptData,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Lokalprognose (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedLokal() {
  const { day } = Route.useSearch();
  const { noscript } = Route.useLoaderData();
  return (
    <>
      <noscript>
        <LokalNoscript data={noscript} />
      </noscript>
      <EmbedShell>
        <EmbedFallbackBar
          title="Lokalprognose Amriswil"
          href="https://symbolprognose.lovable.app/karten/lokal"
        />
        <WeatherWidget initialDayIdx={day} />
      </EmbedShell>
    </>
  );
}
