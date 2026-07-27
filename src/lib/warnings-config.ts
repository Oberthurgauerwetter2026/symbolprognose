/**
 * Zentrale Definitionen der Wetterwarnkarte Oberthurgau:
 * Gefahrenarten, Warnstufen, Farben, Gemeinde-Regionen und Textvorlagen.
 * Client- und serverseitig verwendbar (keine Node-/Browser-APIs).
 */

import {
  CloudLightning,
  CloudRain,
  Snowflake,
  ThermometerSnowflake,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { SlipperyCarIcon, WindsockIcon } from "@/components/warnings/hazard-icons";
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
      description:
        "Es treten örtlich Gewitter mit kräftigem Regen, Blitzschlag und Windböen{v: um {v} km/h} auf. Die Gewitter sind kleinräumig und kurzlebig.",
      impact:
        "Zeitweise stark eingeschränkte Sicht, nasse und rutschige Fahrbahnen, vereinzelt kleine Äste am Boden.",
      advice:
        "Aufenthalt im Freien bei aufziehendem Gewitter beenden, lose Gegenstände sichern, Fahrweise anpassen.",
    },
    2: {
      description:
        "Es ziehen kräftige Gewitter mit Starkregen, Hagel und Sturmböen{v: bis {v} km/h} durch. Lokal sind kurze, intensive Niederschlagsspitzen möglich.",
      impact:
        "Lokale Überflutungen von Strassen, Unterführungen und Kellern, herabfallende Äste, Behinderungen im Verkehr, Hagelschäden an Kulturen und Fahrzeugen.",
      advice:
        "Schutz in Gebäuden suchen, Bäume und exponierte Lagen meiden, Fahrzeuge nach Möglichkeit gedeckt abstellen, Abläufe freihalten.",
    },
    3: {
      description:
        "Es treten schwere Gewitter mit heftigem Starkregen, grossem Hagel und orkanartigen Böen{v: bis {v} km/h} auf. Die Entwicklung verläuft rasch und kleinräumig sehr unterschiedlich.",
      impact:
        "Überflutungen, Sachschäden an Gebäuden und Fahrzeugen, umstürzende Bäume, Unterbrüche bei Strom und Verkehr, Gefahr für Personen im Freien.",
      advice:
        "Gebäude nicht verlassen, Fenster und Türen schliessen, gefährdete Bereiche meiden, Meldungen der Behörden verfolgen.",
    },
  },
  regen: {
    1: {
      description:
        "Es fällt anhaltender, zeitweise kräftiger Regen{v: mit Mengen um {v} mm} innerhalb des Warnzeitraums.",
      impact: "Nasse Fahrbahnen, örtlich Aquaplaning, leicht steigende Pegel kleiner Gewässer.",
      advice: "Geschwindigkeit im Strassenverkehr reduzieren, Abflüsse und Schächte freihalten.",
    },
    2: {
      description:
        "Es fällt ergiebiger Dauerregen{v: mit Mengen bis {v} mm} innerhalb des Warnzeitraums.",
      impact:
        "Kleinere Gewässer können über die Ufer treten; Überflutung von Kellern, Unterführungen und tiefliegenden Strassen, örtlich Hangrutsche.",
      advice:
        "Gefährdete Räume räumen, Uferbereiche meiden, Fahrten in überflutungsgefährdete Gebiete verschieben.",
    },
    3: {
      description:
        "Es fällt sehr ergiebiger Dauerregen{v: mit Mengen über {v} mm}. Die Böden sind weitgehend gesättigt.",
      impact:
        "Grossflächige Überschwemmungen, Hochwasser an Bächen und Flüssen, Hangrutsche und Murgänge, längere Verkehrsunterbrüche.",
      advice:
        "Uferbereiche und Hanglagen grossräumig meiden, Anweisungen der Einsatzkräfte befolgen, Notgepäck bereithalten.",
    },
  },
  schnee: {
    1: {
      description: "Es fällt zeitweise Schnee{v: mit Neuschneemengen um {v} cm} bis in tiefe Lagen.",
      impact: "Stellenweise schneebedeckte und rutschige Strassen, leichte Verzögerungen im Verkehr.",
      advice: "Wintergerechte Ausrüstung verwenden, mehr Zeit für Fahrten einplanen.",
    },
    2: {
      description: "Es fällt kräftiger Schneefall{v: mit Neuschneemengen bis {v} cm}.",
      impact:
        "Behinderungen im Strassen- und Bahnverkehr, Schneebruch an Bäumen, erschwerte Räumung, örtlich blockierte Nebenstrassen.",
      advice:
        "Fahrten wenn möglich verschieben, öffentliche Verkehrsmittel nutzen, unter schneebeladenen Bäumen nicht parkieren.",
    },
    3: {
      description:
        "Es fällt intensiver Schneefall{v: mit Neuschneemengen über {v} cm}, örtlich mit Schneeverwehungen.",
      impact:
        "Verkehrswege können unpassierbar werden, Stromausfälle durch Schneebruch, Ausfälle im öffentlichen Verkehr.",
      advice:
        "Auf nicht zwingende Fahrten verzichten, Vorräte und Notbeleuchtung bereithalten, Dächer und Zufahrten im Auge behalten.",
    },
  },
  glaette: {
    1: {
      description:
        "Örtlich bildet sich Glätte durch gefrierende Nässe{v: bei Temperaturen um {v} °C}, vor allem auf Brücken und in Senken.",
      impact: "Rutschgefahr auf Gehwegen, Trottoirs und Nebenstrassen.",
      advice: "Rutschfestes Schuhwerk tragen, Fahrweise und Bremswege anpassen.",
    },
    2: {
      description: "Verbreitet bildet sich Glatteis{v: bei Temperaturen um {v} °C}.",
      impact:
        "Erhöhte Unfallgefahr im Strassenverkehr, Sturzgefahr für Fussgängerinnen und Fussgänger, Verspätungen im öffentlichen Verkehr.",
      advice:
        "Fahrten nach Möglichkeit verschieben, Gehwege salzen oder splitten, besonders vorsichtig gehen.",
    },
    3: {
      description:
        "Es herrscht flächendeckendes Glatteis{v: bei Temperaturen um {v} °C}; Strassen und Wege sind grossflächig spiegelglatt.",
      impact:
        "Der Verkehr kann weitgehend zum Erliegen kommen, schwere Stürze und Unfälle sind zu befürchten.",
      advice: "Das Haus wenn immer möglich nicht verlassen, auf Fahrten verzichten.",
    },
  },
  wind: {
    1: {
      description: "Es treten kräftige Windböen{v: um {v} km/h} auf, in exponierten Lagen stärker.",
      impact: "Lose Gegenstände können verweht werden; auf dem See ist mit Wellengang zu rechnen.",
      advice: "Gartenmöbel und Sonnenschirme sichern, auf dem Wasser Vorsicht walten lassen.",
    },
    2: {
      description: "Es treten Sturmböen{v: bis {v} km/h} auf.",
      impact:
        "Astbruch, umgestürzte Bauzäune und Schirme, Beeinträchtigung des Verkehrs auf exponierten Strecken, gefährlicher Wellengang auf dem See.",
      advice:
        "Wald und Alleen meiden, lose Gegenstände sichern, Bootsfahrten unterlassen, auf Brücken vorsichtig fahren.",
    },
    3: {
      description: "Es treten orkanartige Böen{v: bis {v} km/h} auf.",
      impact:
        "Umstürzende Bäume, Dachschäden, grossflächige Verkehrsunterbrüche und Stromausfälle, erhebliche Gefahr für Personen im Freien.",
      advice:
        "Im Gebäude bleiben, Fenster und Läden schliessen, Wald und Uferbereiche grossräumig meiden.",
    },
  },
  frost: {
    1: {
      description: "Es tritt leichter Frost{v: mit Tiefstwerten um {v} °C} auf.",
      impact: "Empfindliche Pflanzen und ungeschützte Leitungen können Schaden nehmen.",
      advice: "Kübelpflanzen einräumen oder abdecken, Aussenwasserhähne entleeren.",
    },
    2: {
      description: "Es tritt mässiger Frost{v: mit Tiefstwerten um {v} °C} auf.",
      impact: "Kulturen im Freien sind gefährdet, auf Strassen bildet sich Reifglätte.",
      advice:
        "Frostschutzmassnahmen in Landwirtschaft und Garten treffen, morgens mit Glätte rechnen.",
    },
    3: {
      description: "Es tritt strenger Frost{v: mit Tiefstwerten über mehrere Stunden um {v} °C} auf.",
      impact:
        "Gefahr für Landwirtschaft und Wasserleitungen, gesundheitliche Gefährdung ungeschützter Personen.",
      advice:
        "Leitungen isolieren, Tiere schützen, Aufenthalt im Freien verkürzen und warm kleiden.",
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

