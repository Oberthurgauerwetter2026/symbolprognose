/**
 * Referenzstädte rund um den Oberthurgau für die Orientierung auf
 * Radar-, Wind- und Niederschlagssummen-Karten.
 *
 * Grobe Städtetier-Logik:
 * - "large"  werden ab Zoom 8 angezeigt (Ballungsräume / Kantonshauptorte)
 * - "medium" werden ab Zoom 9 angezeigt (Kleinstädte / grössere Bezirksorte)
 *
 * Orte, die bereits in OBERTHURGAU_PLACES enthalten sind (z. B. Amriswil,
 * Arbon, Romanshorn), werden hier absichtlich nicht wiederholt.
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
  { name: "Bregenz", lat: 47.5008, lon: 9.7423, minZoom: 8, tier: "large" },
  { name: "Schaffhausen", lat: 47.6956, lon: 8.638, minZoom: 8, tier: "large" },
  { name: "Friedrichshafen", lat: 47.6563, lon: 9.4751, minZoom: 8, tier: "large" },

  { name: "Basel", lat: 47.5596, lon: 7.5886, minZoom: 8, tier: "large" },
  { name: "Konstanz", lat: 47.6603, lon: 9.1758, minZoom: 8, tier: "large" },
  { name: "Ulm", lat: 48.4011, lon: 9.9876, minZoom: 8, tier: "large" },
  { name: "Luzern", lat: 47.0502, lon: 8.3093, minZoom: 8, tier: "large" },
  { name: "Chur", lat: 46.8508, lon: 9.532, minZoom: 8, tier: "large" },
  { name: "Innsbruck", lat: 47.2692, lon: 11.4041, minZoom: 8, tier: "large" },
  { name: "Kempten", lat: 47.7267, lon: 10.3139, minZoom: 8, tier: "large" },
  { name: "Freiburg i. Br.", lat: 47.999, lon: 7.8421, minZoom: 8, tier: "large" },
  { name: "Aarau", lat: 47.3925, lon: 8.0444, minZoom: 8, tier: "large" },
  { name: "Feldkirch", lat: 47.2378, lon: 9.598, minZoom: 8, tier: "large" },

  // --- medium: ab Zoom 9 ---
  { name: "Frauenfeld", lat: 47.5578, lon: 8.8989, minZoom: 9, tier: "medium" },
  { name: "Wil", lat: 47.4625, lon: 9.0405, minZoom: 9, tier: "medium" },
  { name: "Kreuzlingen", lat: 47.6505, lon: 9.1748, minZoom: 9, tier: "medium" },
  { name: "Ravensburg", lat: 47.7823, lon: 9.6108, minZoom: 9, tier: "medium" },
  { name: "Rapperswil-Jona", lat: 47.2266, lon: 8.8184, minZoom: 9, tier: "medium" },
  { name: "Lindau", lat: 47.5459, lon: 9.6839, minZoom: 9, tier: "medium" },
  { name: "Dornbirn", lat: 47.4125, lon: 9.7417, minZoom: 9, tier: "medium" },
  { name: "Singen", lat: 47.7594, lon: 8.84, minZoom: 9, tier: "medium" },
  { name: "Herisau", lat: 47.3861, lon: 9.2792, minZoom: 9, tier: "medium" },
  { name: "Appenzell", lat: 47.3313, lon: 9.4096, minZoom: 9, tier: "medium" },
  { name: "Altstätten", lat: 47.3777, lon: 9.5475, minZoom: 9, tier: "medium" },
  { name: "Buchs SG", lat: 47.1667, lon: 9.4775, minZoom: 9, tier: "medium" },
  { name: "Vaduz", lat: 47.141, lon: 9.5209, minZoom: 9, tier: "medium" },
  { name: "Zug", lat: 47.1662, lon: 8.5155, minZoom: 9, tier: "medium" },
  { name: "Baden", lat: 47.4733, lon: 8.3059, minZoom: 9, tier: "medium" },
  { name: "Memmingen", lat: 47.9837, lon: 10.1816, minZoom: 9, tier: "medium" },
  { name: "Biberach", lat: 48.0984, lon: 9.7876, minZoom: 9, tier: "medium" },
  { name: "Sigmaringen", lat: 48.0864, lon: 9.2165, minZoom: 9, tier: "medium" },
  { name: "Waldshut", lat: 47.6237, lon: 8.2145, minZoom: 9, tier: "medium" },
  { name: "Wattwil", lat: 47.2995, lon: 9.0866, minZoom: 9, tier: "medium" },
  { name: "Glarus", lat: 47.0404, lon: 9.068, minZoom: 9, tier: "medium" },
  { name: "Bludenz", lat: 47.1547, lon: 9.8222, minZoom: 9, tier: "medium" },
  { name: "Überlingen", lat: 47.7671, lon: 9.1593, minZoom: 9, tier: "medium" },
];

export type Peak = { name: string; lat: number; lon: number; elev: number; minZoom: number };

/** Markante Gipfel als Orientierung, mit Höhe in m ü. M. */
export const REFERENCE_PEAKS: Peak[] = [
  { name: "Säntis", lat: 47.2493, lon: 9.3433, elev: 2502, minZoom: 8 },
  { name: "Pfänder", lat: 47.5086, lon: 9.7806, elev: 1064, minZoom: 9 },
  { name: "Hoher Kasten", lat: 47.2846, lon: 9.4864, elev: 1795, minZoom: 9 },
  { name: "Speer", lat: 47.1997, lon: 9.1308, elev: 1950, minZoom: 9 },
  { name: "Churfirsten", lat: 47.1525, lon: 9.2733, elev: 2306, minZoom: 9 },
  { name: "Glärnisch", lat: 46.9953, lon: 8.9989, elev: 2915, minZoom: 9 },
  { name: "Tödi", lat: 46.8115, lon: 8.9145, elev: 3614, minZoom: 8 },
  { name: "Rigi", lat: 47.0567, lon: 8.4853, elev: 1798, minZoom: 9 },
  { name: "Pilatus", lat: 46.9789, lon: 8.2541, elev: 2128, minZoom: 9 },
  { name: "Uetliberg", lat: 47.3497, lon: 8.4919, elev: 870, minZoom: 10 },
  { name: "Hörnli", lat: 47.3712, lon: 8.9416, elev: 1133, minZoom: 10 },
  { name: "Zugspitze", lat: 47.4211, lon: 10.9853, elev: 2962, minZoom: 8 },
  { name: "Feldberg", lat: 47.8739, lon: 8.0042, elev: 1493, minZoom: 9 },
  { name: "Hoher Ifen", lat: 47.3542, lon: 10.1006, elev: 2230, minZoom: 9 },
  { name: "Schesaplana", lat: 47.0547, lon: 9.7083, elev: 2964, minZoom: 9 },
  { name: "Ringelspitz", lat: 46.8944, lon: 9.3311, elev: 3248, minZoom: 9 },
];
