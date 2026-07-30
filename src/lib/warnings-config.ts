/**
 * Zentrale Definitionen der Wetterwarnkarte Oberthurgau:
 * Gefahrenarten, Warnstufen, Farben, Gemeinde-Regionen und Textvorlagen.
 * Client- und serverseitig verwendbar (keine Node-/Browser-APIs).
 */

import { ThermometerSnowflake } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import {
  BoltIcon,
  RainDropsIcon,
  SnowflakesIcon,
  SlipperyCarIcon,
  WindsockIcon,
} from "@/components/warnings/hazard-icons";
import type { FeatureCollection } from "geojson";
import regionData from "@/data/region.json";

export type HazardId = "gewitter" | "regen" | "schnee" | "glaette" | "wind" | "frost";
export type WarnLevel = 1 | 2 | 3;

export type HazardIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface HazardDef {
  id: HazardId;
  label: string;
  /** Titelbaustein: „Gewitterwarnung (Stufe 2)“ */
  title: string;
  icon: HazardIcon;
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
    icon: BoltIcon,
    paramLabel: "Böenspitzen",
    paramUnit: "km/h",
    paramPlaceholder: "z. B. 75",
  },
  {
    id: "regen",
    label: "Regen",
    title: "Regenwarnung",
    icon: RainDropsIcon,
    paramLabel: "Niederschlagsmenge",
    paramUnit: "mm",
    paramPlaceholder: "z. B. 40",
  },
  {
    id: "schnee",
    label: "Schnee",
    title: "Schneefallwarnung",
    icon: SnowflakesIcon,
    paramLabel: "Neuschnee",
    paramUnit: "cm",
    paramPlaceholder: "z. B. 15",
  },
  {
    id: "glaette",
    label: "Strassenglätte",
    title: "Warnung vor Strassenglätte",
    icon: SlipperyCarIcon,
    paramLabel: "Temperatur",
    paramUnit: "°C",
    paramPlaceholder: "z. B. -3",
  },
  {
    id: "wind",
    label: "Wind",
    title: "Windwarnung",
    icon: WindsockIcon,
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
  /** Empfohlenes Verhalten (Verhaltenshinweis wie bei MeteoSchweiz/DWD). */
  advice: string;
}

/**
 * Standardisierte Warntexte im Stil eines offiziellen Wetterdienstes:
 * Ereignis mit Kennwert (Was) – Auswirkungen – empfohlenes Verhalten.
 * `{v}` wird durch den optionalen Messwert ersetzt.
 */
export const TEMPLATES: Record<HazardId, Record<WarnLevel, Template>> = {
  gewitter: {
    1: {
      description: "Örtlich Gewitter mit kurzem Starkregen{v: und Böen bis {v} km/h}.",
      impact:
        "Kurzzeitig eingeschränkte Sicht und nasse Fahrbahnen. Vereinzelt kleiner Astbruch möglich.",
      advice: "Lose Gegenstände sichern. Fahrweise den Verhältnissen anpassen.",
    },
    2: {
      description: "Kräftige Gewitter mit Starkregen und Hagel{v:, Sturmböen bis {v} km/h}.",
      impact:
        "Lokale Überflutungen von Strassen und Unterführungen sind möglich. Astbruch, Behinderungen im Verkehr sowie Hagelschäden an Kulturen und Fahrzeugen sind zu erwarten.",
      advice:
        "Aufenthalt im Freien vermeiden. Fahrzeuge nach Möglichkeit gedeckt abstellen. Abläufe freihalten.",
    },
    3: {
      description: "Schwere Gewitter mit heftigem Starkregen und grossem Hagel{v:, Böen bis {v} km/h}.",
      impact:
        "Überflutungen, Sachschäden an Gebäuden und Fahrzeugen sowie umstürzende Bäume sind möglich. Unterbrüche bei Strom und Verkehr sind zu erwarten.",
      advice:
        "Gebäude nicht verlassen. Fenster und Türen schliessen. Informationen der Behörden beachten.",
    },
  },
  regen: {
    1: {
      description: "Mässiger Dauerregen{v:, Mengen {v} mm}.",
      impact:
        "Nasse Fahrbahnen und örtlich Aquaplaning. Die Pegel kleiner Gewässer steigen leicht an.",
      advice: "Geschwindigkeit reduzieren. Abläufe und Schächte freihalten.",
    },
    2: {
      description: "Kräftiger Dauerregen{v:, Mengen {v} mm}.",
      impact:
        "Kleinere Gewässer können über die Ufer treten. Überflutungen von Kellern, Unterführungen und tiefliegenden Strassen sowie örtlich Hangrutsche sind möglich.",
      advice:
        "Gefährdete Räume räumen. Uferbereiche meiden. Fahrten in überflutungsgefährdete Gebiete verschieben.",
    },
    3: {
      description: "Sehr ergiebiger Dauerregen{v:, Mengen {v} mm}.",
      impact:
        "Grossflächige Überschwemmungen, Hochwasser an Bächen und Flüssen sowie Hangrutsche sind zu erwarten. Verkehrsachsen können längere Zeit unterbrochen sein.",
      advice:
        "Uferbereiche und Hanglagen meiden. Anweisungen der Einsatzkräfte befolgen. Notgepäck bereithalten.",
    },
  },
  schnee: {
    1: {
      description: "Mässiger Schneefall{v:, Neuschnee {v} cm}.",
      impact: "Stellenweise schneebedeckte und rutschige Strassen. Leichte Verzögerungen im Verkehr.",
      advice: "Wintergerechte Ausrüstung verwenden. Mehr Zeit für Fahrten einplanen.",
    },
    2: {
      description: "Kräftiger Schneefall{v:, Neuschnee {v} cm}.",
      impact:
        "Behinderungen im Strassen- und Bahnverkehr sind zu erwarten. Schneebruch an Bäumen und blockierte Nebenstrassen sind möglich.",
      advice:
        "Fahrten nach Möglichkeit verschieben. Öffentliche Verkehrsmittel nutzen. Nicht unter schneebeladenen Bäumen parkieren.",
    },
    3: {
      description: "Intensiver Schneefall mit Verwehungen{v:, Neuschnee {v} cm}.",
      impact:
        "Verkehrswege können unpassierbar werden. Stromausfälle durch Schneebruch und Ausfälle im öffentlichen Verkehr sind möglich.",
      advice:
        "Auf nicht zwingende Fahrten verzichten. Vorräte und Notbeleuchtung bereithalten. Dächer und Zufahrten im Auge behalten.",
    },
  },
  glaette: {
    1: {
      description: "Örtlich Glätte durch gefrierende Nässe, vor allem auf Brücken und in Senken{v:, um {v} °C}.",
      impact: "Rutschgefahr auf Trottoirs, Gehwegen und Nebenstrassen.",
      advice: "Rutschfestes Schuhwerk tragen. Fahrweise und Bremswege anpassen.",
    },
    2: {
      description: "Verbreitet Glatteis{v:, um {v} °C}.",
      impact:
        "Erhöhte Unfallgefahr im Strassenverkehr und Sturzgefahr für Fussgängerinnen und Fussgänger. Verspätungen im öffentlichen Verkehr sind zu erwarten.",
      advice:
        "Fahrten nach Möglichkeit verschieben. Gehwege salzen oder splitten. Vorsichtig gehen.",
    },
    3: {
      description: "Grossflächige Vereisung von Strassen und Wegen{v:, um {v} °C}.",
      impact:
        "Der Verkehr kann weitgehend zum Erliegen kommen. Schwere Stürze und Unfälle sind möglich.",
      advice: "Das Haus nach Möglichkeit nicht verlassen. Auf Fahrten verzichten.",
    },
  },
  wind: {
    1: {
      description: "Kräftige Windböen{v: bis {v} km/h}, in exponierten Lagen stärker.",
      impact: "Lose Gegenstände können verweht werden. Auf dem See ist mit Wellengang zu rechnen.",
      advice: "Gartenmöbel und Sonnenschirme sichern. Auf dem Wasser Vorsicht walten lassen.",
    },
    2: {
      description: "Starke bis stürmische Windböen{v: bis {v} km/h}.",
      impact:
        "Astbruch und umgestürzte Bauelemente sind möglich. Auf exponierten Strecken ist mit Verkehrsbehinderungen zu rechnen, auf dem See mit hohem Wellengang.",
      advice:
        "Wald und Alleen meiden. Lose Gegenstände sichern. Auf Bootsfahrten verzichten. Auf Brücken vorsichtig fahren.",
    },
    3: {
      description: "Schwere Sturm- bis Orkanböen{v: bis {v} km/h}.",
      impact:
        "Umstürzende Bäume, Dachschäden, Verkehrsunterbrüche und Stromausfälle sind zu erwarten. Für Personen im Freien besteht erhebliche Gefahr.",
      advice:
        "Im Gebäude bleiben. Fenster und Läden schliessen. Wald und Uferbereiche meiden.",
    },
  },
  frost: {
    1: {
      description: "Leichter Frost{v:, Tiefstwerte {v} °C}.",
      impact: "Empfindliche Pflanzen und ungeschützte Leitungen können Schaden nehmen.",
      advice: "Kübelpflanzen einräumen oder abdecken. Aussenwasserhähne entleeren.",
    },
    2: {
      description: "Mässiger Frost{v:, Tiefstwerte {v} °C}, örtlich Reifglätte.",
      impact: "Kulturen im Freien sind gefährdet. Auf Strassen bildet sich Reifglätte.",
      advice:
        "Frostschutzmassnahmen in Landwirtschaft und Garten treffen. Am Morgen mit Glätte rechnen.",
    },
    3: {
      description: "Strenger Frost{v:, Tiefstwerte {v} °C} über mehrere Stunden.",
      impact:
        "Schäden an Kulturen und Wasserleitungen sind möglich. Für ungeschützte Personen besteht eine gesundheitliche Gefährdung.",
      advice:
        "Leitungen isolieren. Tiere schützen. Aufenthalt im Freien verkürzen und warm kleiden.",
    },
  },
};


/** Auswirkungen + Verhaltenshinweis als ein Textblock (für Formular und Auto-Warnung). */
export function templateImpact(tpl: Template): string {
  return `${tpl.impact} Empfohlenes Verhalten: ${tpl.advice}`;
}

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

