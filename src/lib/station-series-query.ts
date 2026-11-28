import { queryOptions } from "@tanstack/react-query";
import { getStationSeries, getStationSums } from "./station-series.functions";
import type { SeriesRange } from "./station-series";

export interface SeriesInput { stationId: string; range: SeriesRange; anchor?: string; from?: string; to?: string }
/** Derselbe Schlüssel für Kachelvorschau und Grafikseite: der Tagesverlauf wird nur einmal geladen. */
export const seriesQuery = (input: SeriesInput) => queryOptions({
  queryKey: ["station-series", input.stationId, input.range, input.anchor ?? "", input.from ?? "", input.to ?? ""],
  queryFn: () => getStationSeries({ data: input }),
  staleTime: 120_000, refetchInterval: 300_000,
});
export const sumsQuery = (from: string, to: string) => queryOptions({
  queryKey: ["station-sums", from, to],
  queryFn: () => getStationSums({ data: { from, to } }),
  staleTime: 120_000, refetchInterval: 300_000,
});
