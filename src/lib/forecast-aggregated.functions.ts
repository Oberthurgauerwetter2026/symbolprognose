import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { fetchForecast, type ForecastResponse } from "./weather";

/**
 * Serverseitiges Multi-Modell-Aggregat.
 *
 * Browser rufen dieses serverFn statt direkt Open-Meteo aufzurufen. Damit:
 * - Open-Meteo sieht nur Worker-IPs (statt jeden Besucher).
 * - Antwort wird am Cloudflare-Edge gecacht (s-maxage=900) → bei vielen
 *   Besuchern auf denselben Spot fällt fast jeder Request auf den Cache.
 *
 * Kein Auth — public read.
 */
export const getAggregatedForecast = createServerFn({ method: "GET" })
  .inputValidator((input: { lat: number; lon: number }) => {
    if (typeof input?.lat !== "number" || typeof input?.lon !== "number") {
      throw new Error("lat/lon required");
    }
    // Auf 4 Nachkommastellen runden → Cache-Key-Stabilität für nahe Punkte.
    return {
      lat: Math.round(input.lat * 10_000) / 10_000,
      lon: Math.round(input.lon * 10_000) / 10_000,
    };
  })
  .handler(async ({ data }): Promise<ForecastResponse> => {
    setResponseHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    );
    return await fetchForecast(data.lat, data.lon);
  });
