// MOSMIX-L Stationen + nearest-Station-Helper.
// Client-safe (keine Server-Imports), wird von mosmix.functions.ts
// und src/routes/admin.tsx genutzt.

export type MosmixStation = { id: string; name: string; lat: number; lon: number };

export const MOSMIX_STATIONS: MosmixStation[] = [
  // Schweiz
  { id: "06601", name: "Basel",             lat: 47.533, lon: 7.583 },
  { id: "06604", name: "Neuchâtel",         lat: 47.000, lon: 6.950 },
  { id: "06610", name: "Payerne",           lat: 46.817, lon: 6.933 },
  { id: "06612", name: "La Chaux-de-Fonds", lat: 47.083, lon: 6.800 },
  { id: "06620", name: "Schaffhausen",      lat: 47.683, lon: 8.617 },
  { id: "06621", name: "Güttingen",         lat: 47.600, lon: 9.283 },
  { id: "06630", name: "Bern",              lat: 46.917, lon: 7.500 },
  { id: "06631", name: "Bern-Liebefeld",    lat: 46.983, lon: 7.450 },
  { id: "06632", name: "Grenchen",          lat: 47.183, lon: 7.417 },
  { id: "06650", name: "Luzern",            lat: 47.017, lon: 8.300 },
  { id: "06660", name: "Zürich (Stadt)",    lat: 47.383, lon: 8.567 },
  { id: "06670", name: "Zürich-Kloten",     lat: 47.483, lon: 8.533 },
  { id: "06678", name: "Bischofszell",      lat: 47.500, lon: 9.233 },
  { id: "06679", name: "Tänikon",           lat: 47.467, lon: 8.900 },
  { id: "06680", name: "Säntis",            lat: 47.250, lon: 9.333 },
  { id: "06681", name: "St. Gallen",        lat: 47.433, lon: 9.400 },
  { id: "06690", name: "Altenrhein",        lat: 47.483, lon: 9.567 },
  { id: "06700", name: "Genf",              lat: 46.250, lon: 6.133 },
  { id: "06711", name: "Pully",             lat: 46.517, lon: 6.667 },
  { id: "06720", name: "Sion",              lat: 46.217, lon: 7.333 },
  { id: "06734", name: "Interlaken",        lat: 46.667, lon: 7.867 },
  { id: "06760", name: "Locarno-Monti",     lat: 46.167, lon: 8.783 },
  { id: "06775", name: "Lugano",            lat: 46.000, lon: 8.900 },
  { id: "06784", name: "Davos",             lat: 46.817, lon: 9.850 },
  { id: "06786", name: "Chur",              lat: 46.867, lon: 9.533 },
  // Grenznahe Nachbarstationen
  { id: "10836", name: "Friedrichshafen",   lat: 47.670, lon: 9.510 },
  { id: "10929", name: "Konstanz",          lat: 47.680, lon: 9.190 },
  { id: "11120", name: "Innsbruck",         lat: 47.260, lon: 11.360 },
  { id: "16080", name: "Milano-Malpensa",   lat: 45.620, lon: 8.730 },
  { id: "07480", name: "Lyon-Bron",         lat: 45.730, lon: 4.940 },
];

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestMosmixStation(lat: number, lon: number) {
  let best = MOSMIX_STATIONS[0];
  let bestDist = Infinity;
  for (const s of MOSMIX_STATIONS) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return { station: best, distanceKm: bestDist };
}
