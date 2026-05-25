import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getOpenMeteoCache } from "./openmeteo-cache.server";

/**
 * Multi-Modell-Forecast aus dem R2-Cache (phaseA).
 *
 * Liest den 7-Tage Multi-Modell-Forecast für den nächstgelegenen Grid-Punkt
 * zur angefragten Lat/Lon. Damit kann das Frontend die gleichen Daten lesen,
 * die sonst direkt von api.open-meteo.com kämen — aber ohne IP-Limit-Risiko.
 *
 * Die per-Modell-Aufschlüsselung (icon_ch2 / icon_d2 / arpege / ecmwf / gfs)
 * steckt in den Schlüsseln `hourly_X` bzw. `*_<model>` der Open-Meteo-Antwort
 * und wird hier unverändert weitergereicht.
 */

export interface MultiModelLocationForecast {
  latitude: number;
  longitude: number;
  timezone?: string;
  utc_offset_seconds?: number;
  generatedAt: string;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

type Loc = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
};

function dist2(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = a.lat - b.lat;
  const dLon = a.lon - b.lon;
  return dLat * dLat + dLon * dLon;
}

export const getMultiModelForecast = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number }) => {
    if (typeof input?.lat !== "number" || typeof input?.lon !== "number") {
      throw new Error("lat/lon required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<MultiModelLocationForecast | null> => {
    setResponseHeader("Cache-Control", "public, max-age=60, s-maxage=120");

    const cache = await getOpenMeteoCache();
    if (!cache?.phaseA?.length) {
      console.warn("[forecast] phaseA missing in R2 cache");
      return null;
    }

    const locs = cache.phaseA as Loc[];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < locs.length; i++) {
      const lat = locs[i]?.latitude;
      const lon = locs[i]?.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const d = dist2({ lat: data.lat, lon: data.lon }, { lat, lon });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const best = locs[bestIdx];
    if (!best) return null;

    return {
      latitude: best.latitude ?? data.lat,
      longitude: best.longitude ?? data.lon,
      timezone: best.timezone,
      utc_offset_seconds: best.utc_offset_seconds,
      generatedAt: cache.generatedAt,
      hourly: best.hourly,
      daily: best.daily,
    };
  });
