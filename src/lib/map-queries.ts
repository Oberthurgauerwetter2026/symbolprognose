/**
 * Gemeinsame Query-Definitionen für alle Kartenrouten.
 *
 * Wichtig: Loader (prefetch) und Komponente müssen denselben Query-Key und
 * dieselbe queryFn benutzen, sonst wird zweimal geladen.
 */

import { queryOptions } from "@tanstack/react-query";

import { SPOTS } from "@/data/spots";
import { getAggregatedForecastBatch } from "@/lib/forecast-aggregated.functions";
import { getRadarFrames } from "@/lib/radar.functions";
import {
  getSatelliteManifest,
  type SatelliteRegionId,
} from "@/lib/satellite.functions";
import { listWarnings } from "@/lib/warnings.functions";
import { getWindFrames } from "@/lib/wind.functions";

/** Query-Key-Präfixe, die über Seitenneuladen hinweg gespeichert werden. */
export const PERSISTED_QUERY_PREFIXES = [
  "map-weather-batch",
  "warnings",
  "radar-frames",
  "radar-frames-accum",
  "wind-frames",
  "satellite-manifest",
] as const;

const FORECAST_BATCH_VERSION = "v9";

const FORECAST_POINTS = SPOTS.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon }));

/** Symbolprognose für alle Spots der Regionskarte (ein Batch-Request). */
export const regionForecastQuery = () =>
  queryOptions({
    queryKey: ["map-weather-batch", FORECAST_BATCH_VERSION],
    queryFn: () =>
      getAggregatedForecastBatch({
        data: { points: FORECAST_POINTS, v: FORECAST_BATCH_VERSION },
      }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

/**
 * Aktive Warnungen (Warnkarte, Regionskarte, Lokalprognose).
 * Kurzer staleTime, damit ein frisch geladenes Embed nicht sofort
 * doppelt lädt; Änderungen kommen zusätzlich per Realtime.
 */
export const warningsQuery = () =>
  queryOptions({
    queryKey: ["warnings"],
    queryFn: () => listWarnings(),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
  });

/** Radarframes (Messung + Prognose). */
export const radarFramesQuery = () =>
  queryOptions({
    queryKey: ["radar-frames"],
    queryFn: () => getRadarFrames(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

/** Radarframes mit erweitertem Horizont für die Niederschlagssummen. */
export const radarAccumQuery = () =>
  queryOptions({
    queryKey: ["radar-frames-accum", "extended"],
    queryFn: () => getRadarFrames({ data: { extended: true } }),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

/** Windfelder. */
export const windFramesQuery = () =>
  queryOptions({
    queryKey: ["wind-frames"],
    queryFn: () => getWindFrames(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

/** Satellitenmanifest je Region. */
export const satelliteManifestQuery = (region: SatelliteRegionId) =>
  queryOptions({
    queryKey: ["satellite-manifest", region],
    queryFn: () => getSatelliteManifest({ data: { region } }),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });
