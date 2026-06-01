import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { fetchForecast, type ForecastResponse } from "./weather";

/**
 * Serverseitiges Multi-Modell-Aggregat.
 *
 * `v` ist ein reiner Cache-Bust-Parameter: erhöhen, wenn sich die Aggregations-
 * oder Symbol-Logik ändert und alte Edge-Cache-Antworten umgangen werden müssen.
 */
export const getAggregatedForecast = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number; v?: string | number }) => {
    if (typeof input?.lat !== "number" || typeof input?.lon !== "number") {
      throw new Error("lat/lon required");
    }
    return {
      lat: Math.round(input.lat * 10_000) / 10_000,
      lon: Math.round(input.lon * 10_000) / 10_000,
      v: input?.v != null ? String(input.v) : undefined,
    };
  })
  .handler(async ({ data }): Promise<ForecastResponse> => {
    // Vorübergehend kein Edge-Cache, damit Symbol-/Aggregations-Updates sofort sichtbar sind.
    setResponseHeader("Cache-Control", "no-store, max-age=0");

    return await fetchForecast(data.lat, data.lon);
  });
