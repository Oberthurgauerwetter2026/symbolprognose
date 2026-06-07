import { Map as MapIcon, MapPin, Wind, CloudRain, Droplets, type LucideIcon } from "lucide-react";

export type MapId = "region" | "lokal" | "wind" | "radar" | "niederschlag";

export interface MapDefinition {
  id: MapId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  routePath:
    | "/karten/region"
    | "/karten/lokal"
    | "/karten/wind"
    | "/karten/radar"
    | "/karten/niederschlag";
  embedPath?: "/embed/region" | "/embed/lokal" | "/embed/wind" | "/embed/radar";
  status: "live" | "coming-soon";
  internal?: boolean;
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
    label: "Niederschlagsradar",
    shortLabel: "Niederschlagsradar",
    description: "Niederschlags-Animation: −6 h MCH-Radar, Nowcast und ICON-CH1 Vorhersage bis +24 h.",
    icon: CloudRain,
    routePath: "/karten/radar",
    embedPath: "/embed/radar",
    status: "live",
  },
  {
    id: "niederschlag",
    label: "Niederschlagssummen",
    shortLabel: "Niederschlag",
    description: "Akkumulierter Niederschlag der nächsten 12, 24 und 48 Stunden – stündliche Aktualisierung.",
    icon: Droplets,
    routePath: "/karten/niederschlag",
    status: "live",
  },
];

export function getMap(id: MapId): MapDefinition {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown map id: ${id}`);
  return m;
}
