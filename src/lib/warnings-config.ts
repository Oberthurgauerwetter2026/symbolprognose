/**
 * Zentrale Definitionen der Wetterwarnkarte Oberthurgau:
 * Gefahrenarten, Warnstufen, Farben, Gemeinde-Regionen und Textvorlagen.
 * Client- und serverseitig verwendbar (keine Node-/Browser-APIs).
 */

import {
  CloudLightning,
  CloudRain,
  Snowflake,
  CarFront,
  Wind,
  ThermometerSnowflake,
  type LucideIcon,
} from "lucide-react";
import type { FeatureCollection } from "geojson";
import regionData from "@/data/region.json";

export type HazardId = "gewitter" | "regen" | "schnee" | "glaette" | "wind" | "frost";
export type WarnLevel = 1 | 2 | 3;

export interface HazardDef {
  id: HazardId;
  label: string;
  /** Titelbaustein: „Gewitterwarnung (Stufe 2)“ */
  title: string;
  icon: LucideIcon;
  /** Optionales Messfeld, das die Redaktion selbst ergänzen kann. */
  paramLabel: string;
  paramUnit: string;
  paramPlaceholder: string;
}

export const HAZARDS: HazardDef[] = [
  {
    id: "gewitter",
    label: "Gewitter",
    title: "Gewitterwarnung",
    icon: CloudLightning,
    paramLabel: "Böenspitzen",
    paramUnit: "km/h",
    paramPlaceholder: "z. B. 75",
  },
  {
    id: "regen",
    label: "Regen",
    title: "Regenwarnung",
    icon: CloudRain,
    paramLabel: "Niederschlagsmenge",
    paramUnit: "mm",
    paramPlaceholder: "z. B. 40",
  },
  {
    id: "schnee",
    label: "Schnee",
    title: "Schneefallwarnung",
    icon: Snowflake,
    paramLabel: "Neuschnee",
    paramUnit: "cm",
    paramPlaceholder: "z. B. 15",
  },
  {
    id: "glaette",
    label: "Strassenglätte",
    title: "Warnung vor Strassenglätte",
    icon: CarFront,
    paramLabel: "Temperatur",
    paramUnit: "°C",
    paramPlaceholder: "z. B. -3",
  },
  {
    id: "wind",
    label: "Wind",
    title: "Windwarnung",
    icon: Wind,
    paramLabel: "Böenspitzen",
    paramUnit: "km/h",
    paramPlaceholder: "z. B. 90",
  },
  {
    id: "frost",
    label: "Frost",
    title: "Frostwarnung",
    icon: ThermometerSnowflake,
    paramLabel: "Tiefsttemperatur",
    paramUnit: "°C",
    paramPlaceholder: "z. B. -4",
  },
];

export function getHazard(id: HazardId): HazardDef {
  const h = HAZARDS.find((x) => x.id === id);
  if (!h) throw new Error(`Unbekannte Gefahr: ${id}`);
  return h;
}

export interface LevelDef {
  level: 0 | WarnLevel;
  label: string;
  short: string;
  color: string;
  /** Deckkraft der Gemeinde-Füllung. */
  fillOpacity: number;
  textOnColor: string;
}

export const LEVELS: Record<0 | WarnLevel, LevelDef> = {
  0: { level: 0, label: "Keine Gefahr", short: "Keine", color: "#3ea15c", fillOpacity: 0.28, textOnColor: "#ffffff" },
  1: { level: 1, label: "Stufe 1 · Mässige Gefahr", short: "Stufe 1", color: "#f2c53d", fillOpacity: 0.55, textOnColor: "#20242b" },
  2: { level: 2, label: "Stufe 2 · Grosse Gefahr", short: "Stufe 2", color: "#ef8b30", fillOpacity: 0.6, textOnColor: "#20242b" },
  3: { level: 3, label: "Stufe 3 · Sehr grosse Gefahr", short: "Stufe 3", color: "#d63b32", fillOpacity: 0.65, textOnColor: "#ffffff" },
};

export function levelColor(level: number): string {
  return LEVELS[(Math.max(0, Math.min(3, Math.round(level))) as 0 | WarnLevel)].color;
}

/* ----------------------------- Regionen ------------------------------ */

export interface RegionDef {
  id: string;
  name: string;
}

export function slugifyRegion(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const REGION_FC = regionData as unknown as FeatureCollection;

export const REGIONS: RegionDef[] = REGION_FC.features
  .map((f) => String((f.properties as { name?: string } | null)?.name ?? ""))
  .filter(Boolean)
  .map((name) => ({ id: slugifyRegion(name), name }))
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

export function regionName(id: string): string {
  return REGIONS.find((r) => r.id === id)?.name ?? id;
}

/** Vordefinierte Gruppen für Sammelwarnungen. */
export const REGION_GROUPS: { id: string; label: string; regionIds: string[] }[] = [
  { id: "alle", label: "Alle Gemeinden", regionIds: REGIONS.map((r) => r.id) },
  {
    id: "seeufer",
    label: "Seeufer",
    regionIds: [
      "horn",
      "arbon",
      "egnach",
      "salmsach",
      "romanshorn",
      "uttwil",
      "kesswil",
      "altnau",
      "muensterlingen",
      "guettingen",
      "dozwil",
    ].filter((id) => REGIONS.some((r) => r.id === id)),
  },
  {
    id: "hinterland",
    label: "Hinterland",
    regionIds: [
      "amriswil",
      "sommeri",
      "hefenhofen",
      "hauptwil-gottshaus",
      "bischofszell",
      "hohentannen",
      "zihlschlacht-sitterdorf",
      "erlen",
      "langrickenbach",
      "roggwil",
    ].filter((id) => REGIONS.some((r) => r.id === id)),
  },
];

/* --------------------------- Textvorlagen ---------------------------- */

export interface Template {
  description: string;
  impact: string;
}

/**
 * Standardisierte Warntexte: kurz, sachlich, im Stil eines offiziellen
 * Wetterdienstes. `{v}` wird durch den optionalen Messwert ersetzt.
 */
export const TEMPLATES: Record<HazardId, Record<WarnLevel, Template>> = {
  gewitter: {
    1: {
      description:
        "Es treten lokale Gewitter mit kräftigem Regen, Blitzschlag und Windböen{v: um {v} km/h} auf.",
      impact: "Kurzzeitig erschwerte Sichtverhältnisse und nasse Fahrbahnen sind möglich.",
    },
    2: {
      description:
        "Es ziehen kräftige Gewitter mit Starkregen, Hagel und Sturmböen{v: bis {v} km/h} durch.",
      impact: "Lokale Überflutungen, herabfallende Äste und Behinderungen im Verkehr sind zu erwarten.",
    },
    3: {
      description:
        "Es treten schwere Gewitter mit heftigem Starkregen, grossem Hagel und orkanartigen Böen{v: bis {v} km/h} auf.",
      impact: "Es drohen Überflutungen, Sachschäden an Gebäuden und Fahrzeugen sowie umstürzende Bäume.",
    },
  },
  regen: {
    1: {
      description: "Es fällt anhaltender, teils kräftiger Regen{v: mit Mengen um {v} mm}.",
      impact: "Nasse Fahrbahnen und leicht steigende Pegel kleiner Gewässer sind möglich.",
    },
    2: {
      description: "Es fällt ergiebiger Dauerregen{v: mit Mengen bis {v} mm}.",
      impact: "Kleinere Gewässer können über die Ufer treten, Keller und Unterführungen überflutet werden.",
    },
    3: {
      description: "Es fällt sehr ergiebiger Dauerregen{v: mit Mengen über {v} mm}.",
      impact: "Grossflächige Überschwemmungen, Hangrutsche und Verkehrsunterbrüche sind zu erwarten.",
    },
  },
  schnee: {
    1: {
      description: "Es fällt zeitweise Schnee{v: mit Neuschneemengen um {v} cm}.",
      impact: "Die Strassen sind stellenweise schneebedeckt und rutschig.",
    },
    2: {
      description: "Es fällt kräftiger Schneefall{v: mit Neuschneemengen bis {v} cm}.",
      impact: "Mit Behinderungen im Strassen- und Bahnverkehr sowie Schneebruch ist zu rechnen.",
    },
    3: {
      description: "Es fällt intensiver Schneefall{v: mit Neuschneemengen über {v} cm}.",
      impact: "Verkehrswege können unpassierbar werden; Stromausfälle durch Schneebruch sind möglich.",
    },
  },
  glaette: {
    1: {
      description: "Örtlich bildet sich Glätte durch gefrierende Nässe{v: bei Temperaturen um {v} °C}.",
      impact: "Auf Gehwegen und Nebenstrassen besteht Rutschgefahr.",
    },
    2: {
      description: "Verbreitet bildet sich Glatteis{v: bei Temperaturen um {v} °C}.",
      impact: "Es besteht erhöhte Unfallgefahr im Strassenverkehr und Sturzgefahr für Fussgänger.",
    },
    3: {
      description: "Es herrscht flächendeckendes Glatteis{v: bei Temperaturen um {v} °C}.",
      impact: "Der Verkehr kann weitgehend zum Erliegen kommen; schwere Stürze sind zu befürchten.",
    },
  },
  wind: {
    1: {
      description: "Es treten kräftige Windböen{v: um {v} km/h} auf.",
      impact: "Lose Gegenstände können verweht werden; auf dem See ist mit Wellengang zu rechnen.",
    },
    2: {
      description: "Es treten Sturmböen{v: bis {v} km/h} auf.",
      impact: "Äste können brechen, der Verkehr auf exponierten Strecken wird beeinträchtigt.",
    },
    3: {
      description: "Es treten orkanartige Böen{v: bis {v} km/h} auf.",
      impact: "Umstürzende Bäume, Dachschäden und grossflächige Verkehrsunterbrüche sind zu erwarten.",
    },
  },
  frost: {
    1: {
      description: "Es tritt leichter Frost{v: mit Tiefstwerten um {v} °C} auf.",
      impact: "Empfindliche Pflanzen und ungeschützte Leitungen können Schaden nehmen.",
    },
    2: {
      description: "Es tritt mässiger Frost{v: mit Tiefstwerten um {v} °C} auf.",
      impact: "Kulturen im Freien sind gefährdet, auf Strassen bildet sich Reifglätte.",
    },
    3: {
      description: "Es tritt strenger Frost{v: mit Tiefstwerten um {v} °C} auf.",
      impact: "Es besteht Gefahr für Landwirtschaft, Wasserleitungen und ungeschützte Personen.",
    },
  },
};

/** Ersetzt `{v: …{v}…}`-Blöcke: mit Wert eingesetzt, ohne Wert entfernt. */
export function fillTemplate(text: string, value?: string | null): string {
  const v = (value ?? "").trim();
  return text
    .replace(/\{v:([^{}]*(?:\{v\}[^{}]*)*)\}/g, (_m, inner: string) =>
      v ? inner.replace(/\{v\}/g, v) : "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

export function warningTitle(hazard: HazardId, level: WarnLevel): string {
  return `${getHazard(hazard).title} (Stufe ${level})`;
}

export function formatRange(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  const d = (x: Date) =>
    `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}. ${String(
      x.getHours(),
    ).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  return `${d(f)} – ${d(t)} Uhr`;
}
