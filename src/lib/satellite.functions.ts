import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Satellitenbild-Animation auf Basis des offenen EUMETView WMS-Service.
 * Datenquelle: https://view.eumetsat.int/geoserver/wms (kein API-Key).
 * Frames werden serverseitig nur als Zeitachse berechnet (rollierend 5 h).
 */

export type SatelliteRegionId =
  | "alpen-ch"
  | "alpen-ch-hd"
  | "europa-geocolour"
  | "europa-ir"
  | "global-ir";

export type SatelliteProvider = "eumetsat-wms" | "gibs-wmts";

export interface SatelliteRegion {
  id: SatelliteRegionId;
  label: string;
  shortLabel: string;
  layer: string;
  fallbackLayer?: string;
  provider?: SatelliteProvider;
  /** Nur für GIBS: WMTS TileMatrixSet */
  tileMatrixSet?: string;
  center: [number, number];
  zoom: number;
  stepMinutes: number;
  latencyMinutes: number;
  /** Quellen-/Sensor-Bezeichnung für UI-Badge */
  source: string;
  description: string;
}

export const SATELLITE_REGIONS: SatelliteRegion[] = [
  {
    id: "alpen-ch",
    label: "Schweiz & Alpen",
    shortLabel: "Schweiz & Alpen",
    layer: "mtg_hrfi:rgb_geocolour",
    fallbackLayer: "mtg_fd:rgb_geocolour",
    center: [46.7, 8.5],
    zoom: 7,
    stepMinutes: 10,
    latencyMinutes: 20,
    source: "EUMETSAT · Meteosat-12 (MTG-FCI HRFI) GeoColour",
    description: "MTG FCI HRFI GeoColour über Schweiz und Alpen — Tag/Nacht (~1 km)",
  },
  {
    id: "alpen-ch-hd",
    label: "Schweiz HD (Tag)",
    shortLabel: "Schweiz HD",
    provider: "gibs-wmts",
    layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    center: [46.7, 8.5],
    zoom: 7,
    stepMinutes: 1440,
    latencyMinutes: 30 * 60,
    source: "NASA GIBS · VIIRS NOAA-20 Corrected Reflectance (Truecolor)",
    description: "Polar-Umlaufsatellit VIIRS Truecolor (~375 m), 1 Bild/Tag",
  },
  {
    id: "europa-geocolour",
    label: "Europa GeoColour",
    shortLabel: "Europa Geo",
    layer: "mtg_hrfi:rgb_geocolour",
    fallbackLayer: "mtg_fd:rgb_geocolour",
    center: [50, 10],
    zoom: 4,
    stepMinutes: 15,
    latencyMinutes: 25,
    source: "EUMETSAT · Meteosat-12 (MTG-FCI HRFI) GeoColour",
    description: "HRFI GeoColour-Komposit über Europa (Tag/Nacht)",
  },
  {
    id: "europa-ir",
    label: "Europa Infrarot",
    shortLabel: "Europa IR",
    layer: "mtg_hrfi:ir105",
    fallbackLayer: "mtg_fd:ir105_hrfi",
    center: [50, 10],
    zoom: 4,
    stepMinutes: 15,
    latencyMinutes: 25,
    source: "EUMETSAT · Meteosat-12 (MTG-FCI HRFI) IR 10.5 µm",
    description: "10.5 µm Infrarot HRFI — Wolkentemperatur",
  },
  {
    id: "global-ir",
    label: "Global Infrarot",
    shortLabel: "Global IR",
    layer: "mumi:worldcloudmap_ir108",
    center: [20, 0],
    zoom: 2,
    stepMinutes: 180,
    latencyMinutes: 60,
    source: "EUMETSAT · Globales IR-Composite",
    description: "Globales IR-Mosaik (3-stündliches Welt-Composite)",
  },
];

export function getRegion(id: SatelliteRegionId): SatelliteRegion {
  const r = SATELLITE_REGIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown satellite region: ${id}`);
  return r;
}

export interface SatelliteFrame {
  time: string;
  label: string;
}

export interface SatelliteManifest {
  region: SatelliteRegionId;
  provider: SatelliteProvider;
  layer: string;
  fallbackLayer?: string;
  tileMatrixSet?: string;
  source: string;
  frames: SatelliteFrame[];
  updatedAt: string;
}

function totalHoursFor(region: SatelliteRegion): number {
  if (region.id === "global-ir") return 5;
  return 3;
}

function floorToStep(date: Date, stepMin: number): Date {
  const ms = stepMin * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function buildFrames(region: SatelliteRegion, now: Date): SatelliteFrame[] {
  const provider = region.provider ?? "eumetsat-wms";

  if (provider === "gibs-wmts") {
    // GIBS: 5 tägliche Frames (Vortag zurück 5 Tage). TIME = YYYY-MM-DD.
    const frames: SatelliteFrame[] = [];
    const latest = new Date(now.getTime() - region.latencyMinutes * 60_000);
    latest.setUTCHours(0, 0, 0, 0);
    for (let i = 4; i >= 0; i--) {
      const d = new Date(latest.getTime() - i * 86_400_000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      frames.push({ time: `${yyyy}-${mm}-${dd}`, label: `${dd}.${mm}.` });
    }
    return frames;
  }

  const latestMs = now.getTime() - region.latencyMinutes * 60_000;
  const latest = floorToStep(new Date(latestMs), region.stepMinutes);
  const count = Math.floor((totalHoursFor(region) * 60) / region.stepMinutes);
  const frames: SatelliteFrame[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(latest.getTime() - i * region.stepMinutes * 60_000);
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    frames.push({ time: t.toISOString(), label: `${hh}:${mm}` });
  }
  return frames;
}

export const getSatelliteManifest = createServerFn({ method: "GET" })
  .inputValidator((data: { region: SatelliteRegionId }) => data)
  .handler(async ({ data }): Promise<SatelliteManifest> => {
    const region = getRegion(data.region);
    const now = new Date();
    setResponseHeader("Cache-Control", "public, max-age=60");
    return {
      region: region.id,
      provider: region.provider ?? "eumetsat-wms",
      layer: region.layer,
      fallbackLayer: region.fallbackLayer,
      tileMatrixSet: region.tileMatrixSet,
      source: region.source,
      frames: buildFrames(region, now),
      updatedAt: now.toISOString(),
    };
  });
