import { Map as MapIcon, MapPin, Wind, CloudRain, Flower2, type LucideIcon } from "lucide-react";

export type MapId = "region" | "lokal" | "wind" | "radar" | "pollen";

export interface MapDefinition {
  id: MapId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  routePath: "/karten/region" | "/karten/lokal" | "/karten/wind" | "/karten/radar" | "/karten/pollen";
  embedPath: "/embed/region" | "/embed/lokal" | "/embed/wind" | "/embed/radar" | "/embed/pollen";
  status: "live" | "coming-soon";
}

export const MAPS: MapDefinition[] = [
  {
    id: "region",
    label: "Wetterkarte Region",
    shortLabel: "Region",
    description: "Symbolprognose, Temperatur und Wind für die Region Oberthurgau.",
    icon: MapIcon,
    routePath: "/karten/region",
    embedPath: "/embed/region",
    status: "live",
  },
  {
    id: "lokal",
    label: "Lokalprognose",
    shortLabel: "Lokal",
    description: "5-Tage-Prognose im 3-Stunden-Takt für jeden Ort.",
    icon: MapPin,
    routePath: "/karten/lokal",
    embedPath: "/embed/lokal",
    status: "live",
  },
  {
    id: "wind",
    label: "Wind-Animation",
    shortLabel: "Wind",
    description: "Animierte Windströmung mit Pfeil- und Partikel-Visualisierung.",
    icon: Wind,
    routePath: "/karten/wind",
    embedPath: "/embed/wind",
    status: "coming-soon",
  },
  {
    id: "radar",
    label: "Radar",
    shortLabel: "Radar",
    description: "Niederschlags-Animation: −12 h Radar-Nowcast und Vorhersage (ICON-CH1/CH2).",
    icon: CloudRain,
    routePath: "/karten/radar",
    embedPath: "/embed/radar",
    status: "live",
  },
  {
    id: "pollen",
    label: "Pollenprognose",
    shortLabel: "Pollen",
    description: "Pollenbelastung nach Pflanzenart und Tagesverlauf.",
    icon: Flower2,
    routePath: "/karten/pollen",
    embedPath: "/embed/pollen",
    status: "coming-soon",
  },
];

export function getMap(id: MapId): MapDefinition {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown map id: ${id}`);
  return m;
}
