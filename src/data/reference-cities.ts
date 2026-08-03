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
  { name: "Konstanz", lat: 47.6603, lon: 9.1758, minZoom: 8, tier: "large" },
  { name: "Bregenz", lat: 47.5008, lon: 9.7423, minZoom: 8, tier: "large" },
  { name: "Schaffhausen", lat: 47.6956, lon: 8.638, minZoom: 8, tier: "large" },
  { name: "Friedrichshafen", lat: 47.6563, lon: 9.4751, minZoom: 8, tier: "large" },

  // --- medium: ab Zoom 9 ---
  { name: "Frauenfeld", lat: 47.5578, lon: 8.8989, minZoom: 9, tier: "medium" },
  { name: "Wil", lat: 47.4625, lon: 9.0405, minZoom: 9, tier: "medium" },
  { name: "Kreuzlingen", lat: 47.6505, lon: 9.1748, minZoom: 9, tier: "medium" },
  { name: "Dornbirn", lat: 47.412, lon: 9.7416, minZoom: 9, tier: "medium" },
  { name: "Ravensburg", lat: 47.7823, lon: 9.6108, minZoom: 9, tier: "medium" },
  { name: "Rapperswil-Jona", lat: 47.2266, lon: 8.8184, minZoom: 9, tier: "medium" },
  { name: "Uzwil", lat: 47.4372, lon: 9.1377, minZoom: 9, tier: "medium" },
  { name: "Gossau", lat: 47.4159, lon: 9.2485, minZoom: 9, tier: "medium" },
  { name: "Herisau", lat: 47.3862, lon: 9.2789, minZoom: 9, tier: "medium" },
  { name: "Appenzell", lat: 47.3294, lon: 9.4076, minZoom: 9, tier: "medium" },
  { name: "Trogen", lat: 47.4082, lon: 9.466, minZoom: 9, tier: "medium" },
  { name: "Heiden", lat: 47.442, lon: 9.5325, minZoom: 9, tier: "medium" },
  { name: "Wattwil", lat: 47.351, lon: 9.0867, minZoom: 9, tier: "medium" },
  { name: "Flawil", lat: 47.4372, lon: 9.1998, minZoom: 9, tier: "medium" },
];
