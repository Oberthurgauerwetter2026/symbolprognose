import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";
import { WeatherWidget } from "@/components/weather-widget";
import {
  RegionLokalNoscript,
  type RegionLokalNoscriptData,
} from "@/components/embeds/region-lokal-noscript";
import { type LokalNoscriptData } from "@/components/embeds/lokal-noscript";
import { getRadarFrames } from "@/lib/radar.functions";
import { getMultiModelForecast } from "@/lib/forecast.functions";

// RegionMap importiert Leaflet auf Modul-Ebene (window-Zugriff). Daher
// dynamisch + nur clientseitig laden, damit die Route SSR-fähig bleibt
// und der <noscript>-Fallback im initialen HTML landet.
const RegionMapLazy = lazy(() =>
  import("@/components/region-map").then((m) => ({ default: m.RegionMap })),
);

const AMRISWIL = { name: "Amriswil", latitude: 47.5469, longitude: 9.2986 };

function buildForecastNoscript(
  fc: Awaited<ReturnType<typeof getMultiModelForecast>> | null,
): LokalNoscriptData {
  const h = fc?.hourly ?? {};
  const d = fc?.daily ?? {};
  const times = (h.time as string[] | undefined) ?? [];
  const now = Date.now();

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

function buildNoscript(
  frames: Awaited<ReturnType<typeof getRadarFrames>> | null,
  fc: Awaited<ReturnType<typeof getMultiModelForecast>> | null,
): RegionLokalNoscriptData {
  let mapImageUrl: string | undefined;
  let mapImageTime: string | undefined;
  if (frames?.frames?.length) {
    for (let i = frames.frames.length - 1; i >= 0; i--) {
      const f = frames.frames[i];
      if (f.source === "radar" && f.precipUrl) {
        mapImageUrl = f.precipUrl;
        mapImageTime = f.t;
        break;
      }
    }
  }

  return {
    mapImageUrl,
    mapImageTime,
    forecast: buildForecastNoscript(fc),
  };
}

export const Route = createFileRoute("/embed/region-lokal")({
  component: EmbedRegionLokal,
  loader: async () => {
    try {
      const [frames, fc] = await Promise.all([
        getRadarFrames().catch(() => null),
        getMultiModelForecast({
          data: { lat: AMRISWIL.latitude, lon: AMRISWIL.longitude },
        }).catch(() => null),
      ]);
      return { noscript: buildNoscript(frames, fc) };
    } catch {
      return {
        noscript: {
          forecast: { locationName: AMRISWIL.name, hourly: [], daily: [] },
        } satisfies RegionLokalNoscriptData,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Wetterkarte + Lokalprognose Amriswil (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRegionLokal() {
  const { noscript } = Route.useLoaderData();
  return (
    <>
      <noscript>
        <RegionLokalNoscript data={noscript} />
      </noscript>
      <EmbedShell>
        <div className="@container flex w-full flex-col gap-2">
          <ClientOnly
            fallback={
              <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
            }
          >
            <Suspense
              fallback={
                <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
              }
            >
              <RegionMapLazy bare />
            </Suspense>
          </ClientOnly>
          <WeatherWidget detailOnly compact lockedLocation={AMRISWIL} />
        </div>
      </EmbedShell>
    </>
  );
}
