import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Satellitenbild-Animation auf Basis des offenen EUMETView WMS-Service.
 *
 * Datenquelle: https://view.eumetsat.int/geoserver/wms
 * Kein API-Key, kein Ingest — der Browser holt jedes Frame direkt als WMS-Tile.
 *
 * Frames werden serverseitig nur als Zeitachse berechnet (alle 5 Stunden
 * rückwirkend ab "jetzt", abzüglich produkt-spezifischem Latency-Puffer).
 */

export type SatelliteRegionId =
  | "schweiz"
  | "alpen"
  | "europa-geocolour"
  | "europa-ir"
  | "global-ir";

export interface SatelliteRegion {
  id: SatelliteRegionId;
  label: string;
  shortLabel: string;
  /** EUMETView WMS LAYERS value */
  layer: string;
  /** Fallback-Layer falls primärer Layer leer ist */
  fallbackLayer?: string;
  /** Default-Kartenzentrum [lat, lon] */
  center: [number, number];
  /** Default-Zoomstufe */
  zoom: number;
  /** Frame-Intervall in Minuten */
  stepMinutes: number;
  /** Publikations-Latenz in Minuten (jüngster Frame = now - latency) */
  latencyMinutes: number;
  /** Kurze Beschreibung für UI-Tooltip */
  description: string;
}

export const SATELLITE_REGIONS: SatelliteRegion[] = [
  {
    id: "schweiz",
    label: "Schweiz",
    shortLabel: "Schweiz",
    layer: "mtg_fd:rgb_truecolor",
    fallbackLayer: "msg_fes:rgb_naturalenhncd",
    center: [46.8, 8.2],
    zoom: 7,
    stepMinutes: 10,
    latencyMinutes: 20,
    description: "MTG FCI True Color über der Schweiz",
  },
  {
    id: "alpen",
    label: "Alpen True Colour",
    shortLabel: "Alpen",
    layer: "mtg_fd:rgb_truecolor",
    fallbackLayer: "msg_fes:rgb_naturalenhncd",
    center: [46.5, 10.5],
    zoom: 6,
    stepMinutes: 10,
    latencyMinutes: 20,
    description: "Echtfarbige Wolkenansicht des Alpenraums",
  },
  {
    id: "europa-geocolour",
    label: "Europa GeoColour",
    shortLabel: "Europa Geo",
    layer: "mtg_fd:rgb_geocolour",
    fallbackLayer: "msg_fes:rgb_naturalenhncd",
    center: [50, 10],
    zoom: 4,
    stepMinutes: 15,
    latencyMinutes: 25,
    description: "GeoColour-Komposit über Europa (Tag/Nacht)",
  },
  {
    id: "europa-ir",
    label: "Europa Infrarot",
    shortLabel: "Europa IR",
    layer: "mtg_fd:ir105",
    fallbackLayer: "msg_fes:ir108",
    center: [50, 10],
    zoom: 4,
    stepMinutes: 15,
    latencyMinutes: 25,
    description: "10.5 µm Infrarot — Wolkentemperatur bei Tag und Nacht",
  },
  {
    id: "global-ir",
    label: "Global Infrarot",
    shortLabel: "Global IR",
    layer: "mumi:wideareacoverage_ir",
    center: [20, 0],
    zoom: 2,
    stepMinutes: 30,
    latencyMinutes: 45,
    description: "Globales IR-Mosaik aus mehreren geostationären Satelliten",
  },
];

export function getRegion(id: SatelliteRegionId): SatelliteRegion {
  const r = SATELLITE_REGIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown satellite region: ${id}`);
  return r;
}

export interface SatelliteFrame {
  time: string; // ISO
  label: string; // HH:mm
}

export interface SatelliteManifest {
  region: SatelliteRegionId;
  layer: string;
  fallbackLayer?: string;
  frames: SatelliteFrame[];
  updatedAt: string;
}

const TOTAL_HOURS = 5;

function floorToStep(date: Date, stepMin: number): Date {
  const ms = stepMin * 60_000;
  const t = Math.floor(date.getTime() / ms) * ms;
  return new Date(t);
}

function buildFrames(region: SatelliteRegion, now: Date): SatelliteFrame[] {
  const latestMs = now.getTime() - region.latencyMinutes * 60_000;
  const latest = floorToStep(new Date(latestMs), region.stepMinutes);
  const count = Math.floor((TOTAL_HOURS * 60) / region.stepMinutes);
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
      layer: region.layer,
      fallbackLayer: region.fallbackLayer,
      frames: buildFrames(region, now),
      updatedAt: now.toISOString(),
    };
  });
