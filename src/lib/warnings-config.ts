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
 * Standardisierte Warntexte im Stil von MeteoSchweiz / SRF Meteo:
 * kurzer Ereignissatz, danach optional ein Mengensatz mit Spanne und Zeitraum.
 * `{v: …}` erscheint nur mit erfasstem Messwert, `{h: …}` nur mit bekannter Dauer.
 */
export const TEMPLATES: Record<HazardId, Record<WarnLevel, Template>> = {
  gewitter: {
    1: {
      description: "Örtlich Gewitter.{v: Erwartete Böenspitzen {v} km/h.}",
      impact: "Kurzzeitig Starkregen, nasse Fahrbahnen und eingeschränkte Sicht.",
      advice: "Lose Gegenstände sichern. Fahrweise anpassen.",
    },
    2: {
      description: "Kräftige Gewitter mit Starkregen und Hagel.{v: Erwartete Böenspitzen {v} km/h.}",
      impact: "Lokale Überflutungen, Astbruch und Hagelschäden möglich.",
      advice: "Aufenthalt im Freien meiden. Fahrzeuge nach Möglichkeit gedeckt abstellen.",
    },
    3: {
      description:
        "Schwere Gewitter mit Starkregen, Hagel und Sturmböen.{v: Erwartete Böenspitzen {v} km/h.}",
      impact:
        "Überflutungen, Hagelschäden und umstürzende Bäume möglich. Örtlich Unterbrüche bei Strom und Verkehr.",
      advice: "Im Gebäude bleiben. Fenster und Türen schliessen.",
    },
  },
  regen: {
    1: {
      description: "Mässiger Regen.{v: Erwartete Mengen {v} mm{h: in {h}}.}",
      impact: "Nasse Fahrbahnen, örtlich stehendes Wasser.",
      advice: "Geschwindigkeit anpassen. Abläufe freihalten.",
    },
    2: {
      description: "Kräftiger Regen.{v: Erwartete Mengen {v} mm{h: in {h}}.}",
      impact:
        "Örtlich Überflutungen von Unterführungen und Kellern. Kleinere Gewässer können anschwellen.",
      advice: "Uferbereiche meiden. Gefährdete Räume sichern.",
    },
    3: {
      description: "Sehr ergiebiger Dauerregen.{v: Erwartete Mengen {v} mm{h: in {h}}.}",
      impact:
        "Überschwemmungen und Hochwasser an Bächen und Flüssen möglich. Örtlich Hangrutsche und Verkehrsbehinderungen.",
      advice: "Uferbereiche und Hanglagen meiden. Anweisungen der Einsatzkräfte befolgen.",
    },
  },
  schnee: {
    1: {
      description: "Mässiger Schneefall.{v: Erwarteter Neuschnee {v} cm{h: in {h}}.}",
      impact: "Stellenweise schneebedeckte Strassen, leichte Verzögerungen im Verkehr.",
      advice: "Wintergerechte Ausrüstung verwenden. Mehr Zeit für Fahrten einplanen.",
    },
    2: {
      description: "Kräftiger Schneefall.{v: Erwarteter Neuschnee {v} cm{h: in {h}}.}",
      impact: "Behinderungen im Strassen- und Bahnverkehr. Örtlich Schneebruch an Bäumen.",
      advice: "Fahrten nach Möglichkeit verschieben. Nicht unter schneebeladenen Bäumen parkieren.",
    },
    3: {
      description:
        "Intensiver Schneefall, teils mit Verwehungen.{v: Erwarteter Neuschnee {v} cm{h: in {h}}.}",
      impact:
        "Verbreitet Verkehrsbehinderungen, einzelne Strassen unpassierbar. Schneebruch und Stromausfälle möglich.",
      advice: "Auf nicht nötige Fahrten verzichten. Vorräte und Notbeleuchtung bereithalten.",
    },
  },
  glaette: {
    1: {
      description:
        "Örtlich Glätte durch gefrierende Nässe, vor allem auf Brücken und in Senken.{v: Erwartete Temperaturen {v} °C.}",
      impact: "Rutschgefahr auf Trottoirs, Gehwegen und Nebenstrassen.",
      advice: "Rutschfestes Schuhwerk tragen. Bremswege anpassen.",
    },
    2: {
      description: "Verbreitet Glatteis.{v: Erwartete Temperaturen {v} °C.}",
      impact: "Erhöhte Unfall- und Sturzgefahr, Verspätungen im öffentlichen Verkehr.",
      advice: "Fahrten nach Möglichkeit verschieben. Gehwege salzen oder splitten.",
    },
    3: {
      description:
        "Grossflächige Vereisung von Strassen und Wegen.{v: Erwartete Temperaturen {v} °C.}",
      impact: "Verbreitet Unfälle und Stürze möglich, Verkehr stark behindert.",
      advice: "Auf Fahrten und Wege im Freien nach Möglichkeit verzichten.",
    },
  },
  wind: {
    1: {
      description: "Kräftige Windböen.{v: Erwartete Böenspitzen {v} km/h.}",
      impact: "Lose Gegenstände können verweht werden. Auf dem See Wellengang.",
      advice: "Gartenmöbel und Sonnenschirme sichern. Auf dem Wasser vorsichtig sein.",
    },
    2: {
      description: "Starke bis stürmische Windböen.{v: Erwartete Böenspitzen {v} km/h.}",
      impact:
        "Örtlich Astbruch und Behinderungen auf exponierten Strecken. Auf dem See hoher Wellengang.",
      advice: "Wald und Alleen meiden. Lose Gegenstände sichern.",
    },
    3: {
      description: "Sturm- bis Orkanböen.{v: Erwartete Böenspitzen {v} km/h.}",
      impact: "Umstürzende Bäume, Dachschäden und Verkehrsunterbrüche möglich.",
      advice: "Aufenthalt im Freien meiden. Fenster und Läden schliessen.",
    },
  },
  frost: {
    1: {
      description: "Leichter Frost.{v: Erwartete Tiefstwerte {v} °C.}",
      impact: "Empfindliche Pflanzen und ungeschützte Leitungen können Schaden nehmen.",
      advice: "Kübelpflanzen einräumen oder abdecken. Aussenwasserhähne entleeren.",
    },
    2: {
      description: "Mässiger Frost, örtlich Reifglätte.{v: Erwartete Tiefstwerte {v} °C.}",
      impact: "Kulturen im Freien gefährdet, am Morgen Reifglätte auf Strassen.",
      advice: "Frostschutzmassnahmen treffen. Am Morgen mit Glätte rechnen.",
    },
    3: {
      description: "Strenger Frost.{v: Erwartete Tiefstwerte {v} °C.}",
      impact: "Schäden an Kulturen und Wasserleitungen möglich.",
      advice: "Leitungen isolieren. Tiere schützen. Warm kleiden.",
    },
  },
};


/** Auswirkungen + Verhaltenshinweis als ein Textblock (für Formular und Auto-Warnung). */
export function templateImpact(tpl: Template): string {
  return `${tpl.impact} Empfohlenes Verhalten: ${tpl.advice}`;
}

/** „12 Stunden“, „1 Stunde“ oder „3 Tagen“ – für den `{h}`-Baustein. */
export function formatDurationLabel(hours: number | null | undefined): string {
  if (!hours || !Number.isFinite(hours) || hours <= 0) return "";
  const h = Math.round(hours);
  if (h <= 0) return "";
  if (h > 48) {
    const d = Math.round(h / 24);
    return d === 1 ? "einem Tag" : `${d} Tagen`;
  }
  return h === 1 ? "1 Stunde" : `${h} Stunden`;
}

/** Ersetzt verschachtelte `{v: …}`- und `{h: …}`-Blöcke inkl. `{v}`/`{h}`-Tokens. */
function renderBlocks(text: string, vals: Record<string, string>): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, open);
    const rest = text.slice(open);
    const token = /^\{(v|h)\}/.exec(rest);
    if (token) {
      out += vals[token[1]] ?? "";
      i = open + token[0].length;
      continue;
    }
    const block = /^\{(v|h):/.exec(rest);
    if (!block) {
      out += "{";
      i = open + 1;
      continue;
    }
    let depth = 1;
    let j = open + block[0].length;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const inner = text.slice(open + block[0].length, depth === 0 ? j - 1 : j);
    out += vals[block[1]] ? renderBlocks(inner, vals) : "";
    i = j;
  }
  return out;
}

/** Vorlage mit Messwert und (optional) Dauer füllen. */
export function fillTemplate(
  text: string,
  value?: string | null,
  durationHours?: number | null,
): string {
  const v = (value ?? "").trim();
  const h = formatDurationLabel(durationHours);
  return renderBlocks(text, { v, h })
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

