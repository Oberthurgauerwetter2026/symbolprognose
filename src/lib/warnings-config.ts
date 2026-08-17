/**
 * Zentrale Definitionen der Wetterwarnkarte Oberthurgau:
 * Gefahrenarten, Warnstufen, Farben, Gemeinde-Regionen und Textvorlagen.
 * Client- und serverseitig verwendbar (keine Node-/Browser-APIs).
 */

import type { ComponentType, SVGProps } from "react";
import {
  BoltIcon,
  FrostIcon,
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
    id: "wind",
    label: "Wind",
    title: "Windwarnung",
    icon: WindsockIcon,
    paramLabel: "Böenspitzen",
    paramUnit: "km/h",
    paramPlaceholder: "z. B. 90",
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
    id: "frost",
    label: "Frost",
    title: "Frostwarnung",
    icon: FrostIcon,
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
      description:
        "Örtlich Gewitter mit kurzzeitigem Starkregen, kleinem Hagel und Windböen.{v: Erwartete Böenspitzen {v} km/h.}",
      impact:
        "Kurzzeitig Starkregen, nasse Fahrbahnen und eingeschränkte Sicht. Örtlich kleiner Hagel und einzelne kräftige Böen.",
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


/**
 * Vorinformationen: Texte weisen auf ein mögliches Ereignis hin,
 * nicht auf eine bereits feststehende Gefahr. Auswirkungen und Verhaltenshinweise
 * bleiben bewusst leer, da sie bei einer reinen Möglichkeitsaussage nicht sinnvoll sind.
 */
export const ADVISORY_TEMPLATES: Record<HazardId, Record<WarnLevel, Template>> = {
  gewitter: {
    1: {
      description: "Erhöhte Schauer- und Gewitterneigung.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich erhöhte Gewitterneigung.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für starke Gewitter.",
      impact: "",
      advice: "",
    },
  },
  regen: {
    1: {
      description: "Erhöhte Regenneigung.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich erhöhte Niederschlagsneigung.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für kräftigen Regen.",
      impact: "",
      advice: "",
    },
  },
  wind: {
    1: {
      description: "Erhöhte Windböen möglich.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich erhöhte Böen möglich.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für stürmische Böen.",
      impact: "",
      advice: "",
    },
  },
  schnee: {
    1: {
      description: "Erhöhte Schneefallneigung.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich erhöhte Schneefallneigung.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für kräftigen Schneefall.",
      impact: "",
      advice: "",
    },
  },
  glaette: {
    1: {
      description: "Erhöhte Glättegefahr.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich erhöhte Glättegefahr.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für grössere Vereisung.",
      impact: "",
      advice: "",
    },
  },
  frost: {
    1: {
      description: "Frost möglich.",
      impact: "",
      advice: "",
    },
    2: {
      description: "Deutlich frostige Bedingungen möglich.",
      impact: "",
      advice: "",
    },
    3: {
      description: "Hohe Wahrscheinlichkeit für strengen Frost.",
      impact: "",
      advice: "",
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


export function warningTitle(hazard: HazardId, level: WarnLevel, advisory = false): string {
  return `${getHazard(hazard).title} (Stufe ${level})`;
}


/**
 * Zeitzonenfeste Darstellung (Europe/Zurich) – wichtig, weil Push-Meldungen,
 * Embeds und Snapshots serverseitig in UTC gerendert werden. Sommer-/Winterzeit
 * wird von Intl automatisch berücksichtigt.
 */
export const ZURICH_TZ = "Europe/Zurich";

export interface ZurichParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = So
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const zurichFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ZURICH_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

export function zurichParts(input: string | number | Date): ZurichParts | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const map: Record<string, string> = {};
  for (const p of zurichFormatter.formatToParts(d)) map[p.type] = p.value;
  const hour = Number(map.hour === "24" ? "0" : map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday ?? "Sun"] ?? 0,
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "20:35" in Schweizer Zeit; Fallback: Eingabe unverändert. */
export function zurichTime(iso: string): string {
  const p = zurichParts(iso);
  return p ? `${p2(p.hour)}:${p2(p.minute)}` : iso;
}

/** "Mo 10.8." in Schweizer Zeit; Fallback: Eingabe unverändert. */
export function zurichWeekdayDate(iso: string): string {
  const p = zurichParts(iso);
  if (!p) return iso;
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][p.weekday];
  return `${wd} ${p.day}.${p.month}.`;
}

/** Stunde des Tages in Schweizer Zeit (für Tag/Nacht-Symbole). */
export function zurichHour(iso: string): number | null {
  return zurichParts(iso)?.hour ?? null;
}

export function formatRange(from: string, to: string): string {
  const d = (x: string) => {
    const p = zurichParts(x);
    if (!p) return x;
    return `${p2(p.day)}.${p2(p.month)}. ${p2(p.hour)}:${p2(p.minute)}`;
  };
  return `${d(from)} – ${d(to)} Uhr`;
}


/* ------------------------ Offizielle Warnschwellen ------------------------ */

/**
 * Warnschwellen nach MeteoSchweiz «Beschreibung zu den Gefahrenstufen»
 * (meteoschweiz.admin.ch → Wetter → Gefahren → Erläuterungen der Gefahrenstufen).
 *
 * MeteoSchweiz nutzt 5 Stufen. Zuordnung auf unsere 3 Warnstufen:
 *   unsere Stufe 1 = MCH 2 (gelb, mässig)
 *   unsere Stufe 2 = MCH 3 (orange, erheblich)
 *   unsere Stufe 3 = MCH 4/5 (rot, gross bis sehr gross)
 *
 * Alle Werte gelten für die Region Oberthurgau: Alpennordseite,
 * Niederungen unter 800 m. Werte für Berge/Alpensüdseite entfallen.
 */
export interface ThresholdRow {
  /** Bezugsdauer in Stunden (null = dauerunabhängig, z. B. Böenspitzen). */
  hours: number | null;
  /** Beschriftung des Bezugszeitraums, z. B. „in 12 Std.“ oder „Böenspitze“. */
  periodLabel: string;
  /** Schwellen für Stufe 1 / 2 / 3 (Messwert erreicht oder übersteigt). */
  limits: [number, number, number];
  /** Einheit, falls sie von der Standardeinheit der Gefahrenart abweicht. */
  unit?: string;
  /** Eigene Setzung (nicht offiziell publiziert). */
  own?: boolean;
}

export interface HazardThresholds {
  /** Einheit des Messwerts. */
  unit: string;
  /** Nach Bezugsdauer gestaffelte Schwellen (leer = nur qualitative Kriterien). */
  rows: ThresholdRow[];
  /** Bezugszeitraum bei rein qualitativen Kriterien. */
  periodNote?: string;
  /** Kurzbeschrieb der offiziellen Kriterien für das Admin-Tool. */
  notes: string[];
  /** Kriterien, die MeteoSchweiz nicht als Zahl publiziert. */
  ownSetting?: string;
}

export const THRESHOLDS: Record<HazardId, HazardThresholds> = {
  gewitter: {
    unit: "km/h",
    rows: [
      { hours: null, periodLabel: "Böenspitze (Momentanwert)", limits: [70, 90, 120] },
      { hours: 1, periodLabel: "Regen pro Stunde", limits: [20, 40, 60], unit: "mm/h", own: true },
    ],
    notes: [
      "Offiziell nur MCH 3/4: Böen 90–120 km/h (Stufe 2), über 120 km/h (Stufe 3).",
      "Alternativ Hagelkorn 2–4 cm (Stufe 2) bzw. über 4 cm (Stufe 3) – Spitzenwert, kein Zeitraum.",
      "Ein erfülltes Kriterium genügt.",
    ],
    ownSetting:
      "Stufe 1 (Böen ab 70 km/h) ist eine eigene Setzung – MeteoSchweiz definiert dafür keine Stufe. Die Regenintensitäten 20/40/60 mm/h sind ebenfalls eine eigene Setzung (MeteoSchweiz: 30–50 mm/h Stufe 2, über 50 mm/h Stufe 3); sie sind bewusst höher gesetzt, damit die Radar-Autowarnung nicht zu häufig auslöst. Für Blitzraten gibt es keine offizielle Schwelle.",
  },
  regen: {
    unit: "mm",
    rows: [
      { hours: 1, periodLabel: "in 1 Std.", limits: [15, 30, 50], own: true },
      { hours: 12, periodLabel: "in 12 Std.", limits: [20, 35, 60] },
      { hours: 24, periodLabel: "in 24 Std.", limits: [30, 50, 80] },
      { hours: 48, periodLabel: "in 48 Std.", limits: [50, 80, 110] },
      { hours: 72, periodLabel: "in 72 Std.", limits: [60, 100, 130] },
    ],
    notes: [
      "Summenwerte über den jeweiligen Zeitraum, Dauerregen Alpennordseite.",
      "Stufe 3 entspricht MCH 4; MCH 5 ab 100/120/150/170 mm (12/24/48/72 Std.).",
    ],
    ownSetting:
      "Die 1-Stunden-Zeile ist eine eigene Setzung, abgeleitet aus den Gewitterkriterien (15/30/50 mm/h) – MeteoSchweiz publiziert für 1–6 Std. keine Regenschwellen.",
  },
  wind: {
    unit: "km/h",
    rows: [{ hours: null, periodLabel: "Böenspitze (Momentanwert)", limits: [70, 90, 110] }],
    notes: [
      "Böenspitze, keine Summe über einen Zeitraum. Flachland/Jura unter 1000 m, MCH 5 ab 140 km/h.",
      "In Gewitterlagen gibt MeteoSchweiz keine separate Windwarnung aus.",
    ],
  },
  schnee: {
    unit: "cm",
    rows: [
      { hours: 12, periodLabel: "in 12 Std.", limits: [5, 10, 20] },
      { hours: 24, periodLabel: "in 24 Std.", limits: [10, 15, 30] },
      { hours: 72, periodLabel: "in 72 Std.", limits: [30, 50, 70] },
    ],
    notes: [
      "Neuschneesummen über den jeweiligen Zeitraum, Niederungen Deutschschweiz unter 800 m.",
      "MCH 5 ab 35/50/90 cm (12/24/72 Std.).",
    ],
  },
  glaette: {
    unit: "°C",
    rows: [],
    periodNote: "Bezug: Glatteismenge innerhalb 6 Std. plus Andauer der Glätte.",
    notes: [
      "Glatteis (gefrierender Regen) unter 2 mm bei T unter 0 °C: Stufe 1.",
      "Glatteis verbreitet über 2 mm bei T unter 0 °C: Stufe 2.",
      "Anhaltendes Glatteis über mehrere Stunden: Stufe 3.",
      "Eis-, Schnee- und Reifglätte: immer nur Stufe 1.",
      "Nur für Lagen unter 800 m – im Oberthurgau überall gültig.",
    ],
  },
  frost: {
    unit: "°C",
    rows: [],
    periodNote: "Bezug: Nacht-Minimum (Temperatur 5 cm über Boden).",
    notes: [
      "Offiziell nur Bodenfrost (5 cm über Boden), 15. März bis 31. Oktober, unter 600 m.",
      "Mässiger Bodenfrost 0 bis −4 °C, starker Bodenfrost unter −4 °C – beides MCH-Stufe 2 (unsere Stufe 1).",
    ],
    ownSetting:
      "Winterfrost ist keine offizielle MeteoSchweiz-Warnung; Stufen 2 und 3 sind hier eine eigene Setzung der Redaktion.",
  },
};


/** Offizielle mm/h-Schwellen für Gewitterregen (Radar-Autowarnung). */
export const THUNDER_RAIN_MMH: [number, number, number] = [15, 30, 50];

/** Passende Schwellenzeile zu einer Warndauer (nächstliegende Bezugsdauer). */
export function thresholdRowFor(hazard: HazardId, hours?: number | null): ThresholdRow | null {
  const rows = THRESHOLDS[hazard].rows;
  if (!rows.length) return null;
  const fixed = rows.find((r) => r.hours === null);
  if (fixed) return fixed;
  if (!hours || !Number.isFinite(hours)) return rows[0];
  return rows.reduce((best, r) =>
    Math.abs((r.hours ?? 0) - hours) < Math.abs((best.hours ?? 0) - hours) ? r : best,
  );
}

/**
 * Empfohlene Warnstufe aus einem Messwert. Bei Temperaturen (Glätte/Frost)
 * gibt es keine numerische Empfehlung – dann `null`.
 */
export function suggestLevel(
  hazard: HazardId,
  value: string | number | null | undefined,
  hours?: number | null,
): WarnLevel | 0 | null {
  const row = thresholdRowFor(hazard, hours);
  if (!row) return null;
  const v = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(v)) return null;
  if (v >= row.limits[2]) return 3;
  if (v >= row.limits[1]) return 2;
  if (v >= row.limits[0]) return 1;
  return 0;
}


