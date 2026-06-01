import { lazy, Suspense } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { EmbedShell } from "@/components/embed-shell";

import { RadarNoscript, type RadarNoscriptData } from "@/components/embeds/radar-noscript";
import { getRadarFrames } from "@/lib/radar.functions";
import { getMultiModelForecast } from "@/lib/forecast.functions";

// RadarMap importiert Leaflet auf Modul-Ebene (window-Zugriff). Daher
// dynamisch + nur clientseitig laden, damit die Route SSR-fähig bleibt
// und der <noscript>-Fallback im initialen HTML landet.
const RadarMapLazy = lazy(() =>
  import("@/components/maps/radar-map").then((m) => ({ default: m.RadarMap })),
);

const AMRISWIL = { lat: 47.5469, lon: 9.2986 };

function buildRadarNoscript(
  frames: Awaited<ReturnType<typeof getRadarFrames>> | null,
  fc: Awaited<ReturnType<typeof getMultiModelForecast>> | null,
): RadarNoscriptData {
  // Jüngstes echtes Radarbild aus dem Manifest.
  let latestImageUrl: string | undefined;
  let latestImageTime: string | undefined;
  if (frames?.frames?.length) {
    for (let i = frames.frames.length - 1; i >= 0; i--) {
      const f = frames.frames[i];
      if (f.source === "radar" && f.precipUrl) {
        latestImageUrl = f.precipUrl;
        latestImageTime = f.t;
        break;
      }
    }
  }

  // Niederschlagsverlauf Amriswil — nächste 12 h (stündlich).
  const h = fc?.hourly ?? {};
  const times = (h.time as string[] | undefined) ?? [];
  const precip = h.precipitation as (number | null)[] | undefined;
  const now = Date.now();
  let startIdx = 0;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (Number.isFinite(t) && t <= now) startIdx = i;
    else break;
  }
  const precipNext: RadarNoscriptData["precipNext"] = [];
  for (let i = startIdx; i < Math.min(startIdx + 12, times.length); i++) {
    const v = precip?.[i];
    precipNext.push({
      time: times[i],
      mmh: typeof v === "number" && Number.isFinite(v) ? v : null,
    });
  }

  // Tagesniederschlag — nächste 5 Tage.
  const d = fc?.daily ?? {};
  const dTimes = (d.time as string[] | undefined) ?? [];
  const dSum = d.precipitation_sum as (number | null)[] | undefined;
  const precipDaily = dTimes.slice(0, 5).map((date, i) => {
    const v = dSum?.[i];
    return { date, mm: typeof v === "number" && Number.isFinite(v) ? v : null };
  });

  return {
    latestImageUrl,
    latestImageTime,
    bbox: frames?.imageBbox,
    precipNext,
    precipDaily,
  };
}

export const Route = createFileRoute("/embed/radar")({
  component: EmbedRadar,
  loader: async () => {
    try {
      const [frames, fc] = await Promise.all([
        getRadarFrames().catch(() => null),
        getMultiModelForecast({
          data: { lat: AMRISWIL.lat, lon: AMRISWIL.lon },
        }).catch(() => null),
      ]);
      return {
        noscript: buildRadarNoscript(frames, fc),
        radar: frames,
      };
    } catch {
      return {
        noscript: { precipNext: [], precipDaily: [] } satisfies RadarNoscriptData,
        radar: null,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Radar (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedRadar() {
  const { noscript, radar } = Route.useLoaderData();
  return (
    <>
      <noscript>
        <RadarNoscript data={noscript} />
      </noscript>
      <EmbedShell fillViewport>
        <div className="flex min-h-0 flex-1 flex-col">
          <ClientOnly
            fallback={
              <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
            }
          >
            <Suspense
              fallback={
                <div className="h-full min-h-[300px] w-full animate-pulse rounded-lg bg-muted" />
              }
            >
              <RadarMapLazy bare initialFrames={radar ?? undefined} />
            </Suspense>
          </ClientOnly>
        </div>
      </EmbedShell>
    </>
  );
}
