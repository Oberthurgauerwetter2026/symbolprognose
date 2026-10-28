/**
 * Referenzstädte rund um den Oberthurgau für die Orientierung auf
 * Radar-, Wind- und Niederschlagssummen-Karten.
 *
 * Bewusst knapp gehalten: nur die Orte, an denen man sich wirklich
 * orientiert. Zu viele Labels überdecken die Niederschlagssignatur.
 *
 * Grobe Städtetier-Logik:
 * - "large"  werden ab Zoom 8 angezeigt (Ballungsräume / Kantonshauptorte)
 * - "medium" werden ab Zoom 9 angezeigt (Kleinstädte / grössere Bezirksorte)
 *
 * Orte, die bereits in OBERTHURGAU_PLACES enthalten sind (z. B. Amriswil,
 * Arbon, Romanshorn), werden hier absichtlich nicht wiederholt.
 *
 * Die deutsche Seite ist mit vertreten — aber nur mit Städten, die dort
 * wirklich zu den grösseren zählen (rund 40'000 Einwohnende aufwärts).
 * Kleine Kur- und Bezirksorte wie Wangen, Isny, Biberach, Sigmaringen,
 * Pfullendorf, Stockach oder Waldshut fehlen bewusst.
 */

export type CityTier = "large" | "medium";

export type ReferenceCity = {
  name: string;
  lat: number;
  lon: number;
  /** Zoom, ab dem der Name erscheint. */
  minZoom: number;
  tier: CityTier;
};

export const REFERENCE_CITIES: ReferenceCity[] = [
  // --- large: ab Zoom 8 ---
  { name: "Zürich", lat: 47.3769, lon: 8.5417, minZoom: 8, tier: "large" },
  { name: "St. Gallen", lat: 47.4245, lon: 9.3767, minZoom: 8, tier: "large" },
  { name: "Winterthur", lat: 47.4992, lon: 8.7261, minZoom: 8, tier: "large" },
  { name: "Schaffhausen", lat: 47.6956, lon: 8.638, minZoom: 8, tier: "large" },
  { name: "Basel", lat: 47.5596, lon: 7.5886, minZoom: 8, tier: "large" },
  { name: "Luzern", lat: 47.0502, lon: 8.3093, minZoom: 8, tier: "large" },
  { name: "Bregenz", lat: 47.5008, lon: 9.7423, minZoom: 8, tier: "large" },
  { name: "Ulm", lat: 48.4011, lon: 9.9876, minZoom: 8, tier: "large" },
  { name: "Chur", lat: 46.8508, lon: 9.532, minZoom: 8, tier: "large" },
  { name: "Innsbruck", lat: 47.2692, lon: 11.4041, minZoom: 8, tier: "large" },
  { name: "Freiburg i. Br.", lat: 47.9961, lon: 7.8497, minZoom: 8, tier: "large" },
  { name: "Ravensburg", lat: 47.7834, lon: 9.6163, minZoom: 8, tier: "large" },

  // --- medium: ab Zoom 9 ---
  { name: "Frauenfeld", lat: 47.5578, lon: 8.8989, minZoom: 9, tier: "medium" },
  { name: "Kreuzlingen", lat: 47.6505, lon: 9.1748, minZoom: 9, tier: "medium" },
  { name: "Wil", lat: 47.4625, lon: 9.0405, minZoom: 9, tier: "medium" },
  { name: "Herisau", lat: 47.3861, lon: 9.2792, minZoom: 9, tier: "medium" },
  { name: "Appenzell", lat: 47.3313, lon: 9.4096, minZoom: 9, tier: "medium" },
  { name: "Vaduz", lat: 47.141, lon: 9.5209, minZoom: 9, tier: "medium" },
  { name: "Altstätten", lat: 47.3777, lon: 9.5475, minZoom: 9, tier: "medium" },

  // deutsche Seite: nur wirklich grössere Städte (rund 40'000 aufwärts)
  { name: "Singen", lat: 47.7594, lon: 8.84, minZoom: 9, tier: "medium" },
  { name: "Friedrichshafen", lat: 47.6539, lon: 9.4794, minZoom: 9, tier: "medium" },
  { name: "Kempten", lat: 47.715, lon: 10.3214, minZoom: 9, tier: "medium" },
  { name: "Memmingen", lat: 47.9872, lon: 10.1891, minZoom: 9, tier: "medium" },
];

export type Peak = {
  name: string;
  lat: number;
  lon: number;
  elev: number;
  minZoom: number;
  /**
   * Versatz des Namens in CSS-Pixeln. Nur nötig, wenn ein Nachbarname sonst
   * direkt am Dreieck anlässt oder den Namen kreuzt.
   */
  labelDx?: number;
  labelDy?: number;
};

/** Markante Gipfel als Orientierung, mit Höhe in m ü. M. */
export const REFERENCE_PEAKS: Peak[] = [
  { name: "Säntis", lat: 47.2493, lon: 9.3433, elev: 2502, minZoom: 8 },
  { name: "Tödi", lat: 46.8115, lon: 8.9145, elev: 3614, minZoom: 8 },
  { name: "Zugspitze", lat: 47.4211, lon: 10.9853, elev: 2962, minZoom: 8 },
  { name: "Hoher Kasten", lat: 47.2846, lon: 9.4864, elev: 1795, minZoom: 9 },
  { name: "Speer", lat: 47.1997, lon: 9.1308, elev: 1950, minZoom: 9 },
  { name: "Churfirsten", lat: 47.1525, lon: 9.2733, elev: 2306, minZoom: 9 },
  { name: "Rigi", lat: 47.0567, lon: 8.4853, elev: 1798, minZoom: 9 },
  { name: "Feldberg", lat: 47.8786, lon: 8.0044, elev: 1493, minZoom: 9 },
  { name: "Ottenberg", lat: 47.5826, lon: 9.1377, elev: 680, minZoom: 9, labelDx: 18 },
];
