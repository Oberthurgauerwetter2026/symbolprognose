/**
 * Lazy-geladene Kartenkomponenten.
 * Bewusst ausserhalb der Routendateien, damit das Route-Code-Splitting
 * keine Modul-Scope-Referenzen aus den Chunks verliert.
 *
 * Jeder Import ist zusätzlich als `preload*`-Funktion verfügbar, damit der
 * Chunk schon beim Hovern über einen Tab bzw. im Route-Loader startet und
 * nicht erst nach dem Rendern der Route.
 */

import { lazy } from "react";

const importRadarMap = () => import("@/components/maps/radar-map");
const importSatelliteMap = () => import("@/components/maps/satellite-map");
const importPrecipAccumMap = () => import("@/components/maps/precip-accum-map");
const importRegionMap = () => import("@/components/region-map");
const importWindMap = () => import("@/components/maps/wind-map");
const importWarnMap = () => import("@/components/maps/warn-map");

export const LazyRadarMap = lazy(() =>
  importRadarMap().then((m) => ({ default: m.RadarMap })),
);

export const LazySatelliteMap = lazy(() =>
  importSatelliteMap().then((m) => ({ default: m.SatelliteMap })),
);

export const LazyPrecipAccumMap = lazy(() =>
  importPrecipAccumMap().then((m) => ({ default: m.PrecipAccumMap })),
);

export const LazyRegionMap = lazy(() =>
  importRegionMap().then((m) => ({ default: m.RegionMap })),
);

export const LazyWindMap = lazy(() =>
  importWindMap().then((m) => ({ default: m.WindMap })),
);

export const LazyWarnMap = lazy(() =>
  importWarnMap().then((m) => ({ default: m.WarnMap })),
);

export const preloadRadarMap = () => void importRadarMap();
export const preloadSatelliteMap = () => void importSatelliteMap();
export const preloadPrecipAccumMap = () => void importPrecipAccumMap();
export const preloadRegionMap = () => void importRegionMap();
export const preloadWindMap = () => void importWindMap();
export const preloadWarnMap = () => void importWarnMap();

/** Chunk-Vorladen pro Karten-Id (Tabs, Übersichtskacheln). */
export const MAP_CHUNK_PRELOADERS: Record<string, () => void> = {
  region: preloadRegionMap,
  radar: preloadRadarMap,
  satellit: preloadSatelliteMap,
  niederschlag: preloadPrecipAccumMap,
};

export function preloadMapChunk(id: string): void {
  MAP_CHUNK_PRELOADERS[id]?.();
}
