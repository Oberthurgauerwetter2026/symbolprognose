/**
 * Lazy-geladene Kartenkomponenten.
 * Bewusst ausserhalb der Routendateien, damit das Route-Code-Splitting
 * keine Modul-Scope-Referenzen aus den Chunks verliert.
 */

import { lazy } from "react";

export const LazyRadarMap = lazy(() =>
  import("@/components/maps/radar-map").then((m) => ({ default: m.RadarMap })),
);

export const LazySatelliteMap = lazy(() =>
  import("@/components/maps/satellite-map").then((m) => ({ default: m.SatelliteMap })),
);

export const LazyPrecipAccumMap = lazy(() =>
  import("@/components/maps/precip-accum-map").then((m) => ({ default: m.PrecipAccumMap })),
);

export const LazyRegionMap = lazy(() =>
  import("@/components/region-map").then((m) => ({ default: m.RegionMap })),
);
