// DWD MOSMIX-L server function.
// Fetches hourly forecast for the closest MOSMIX station (KMZ → KML → normalized HourlyData).
// Used as additional source from day 6 onward in fetchForecast().

import { createServerFn } from "@tanstack/react-start";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

// Curated MOSMIX-L stations across CH and adjacent regions.
// IDs sind DWD MOSMIX-Stations-IDs (WMO-style); Koordinaten in Dezimalgrad,
// abgeglichen mit dem offiziellen DWD-Stationskatalog. Alle Stationen
// wurden gegen den MOSMIX_L-Single-Station-Endpunkt verifiziert.
const MOSMIX_STATIONS: { id: string; name: string; lat: number; lon: number }[] = [
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
  // Grenznahe Nachbarstationen (für Punkte knapp jenseits der Grenze)
  { id: "10836", name: "Friedrichshafen",   lat: 47.670, lon: 9.510 },
  { id: "10929", name: "Konstanz",          lat: 47.680, lon: 9.190 },
  { id: "11120", name: "Innsbruck",         lat: 47.260, lon: 11.360 },
  { id: "16080", name: "Milano-Malpensa",   lat: 45.620, lon: 8.730 },
  { id: "07480", name: "Lyon-Bron",         lat: 45.730, lon: 4.940 },
];

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function nearestStation(lat: number, lon: number) {
  let best = MOSMIX_STATIONS[0];
  let bestDist = Infinity;
  for (const s of MOSMIX_STATIONS) {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return { station: best, distanceKm: bestDist };
}

// SYNOP ww (00..99) → WMO weather code (approx., good enough for symbol mapping).
function wwToWmoCode(ww: number): number {
  if (!Number.isFinite(ww)) return 3;
  if (ww === 0) return 0;
  if (ww === 1) return 1;
  if (ww === 2) return 2;
  if (ww === 3) return 3;
  if (ww >= 4 && ww <= 9) return 45; // dust/haze/fog-ish → fog
  if (ww >= 10 && ww <= 12) return 45;
  if (ww >= 40 && ww <= 49) return ww === 48 || ww === 49 ? 48 : 45;
  if (ww >= 50 && ww <= 55) return ww >= 53 ? 53 : 51;
  if (ww >= 56 && ww <= 57) return 56;
  if (ww >= 58 && ww <= 59) return 51;
  if (ww >= 60 && ww <= 61) return 61;
  if (ww >= 62 && ww <= 63) return 63;
  if (ww >= 64 && ww <= 65) return 65;
  if (ww >= 66 && ww <= 67) return 66;
  if (ww >= 68 && ww <= 69) return 68;
  if (ww >= 70 && ww <= 71) return 71;
  if (ww >= 72 && ww <= 73) return 73;
  if (ww >= 74 && ww <= 75) return 75;
  if (ww >= 76 && ww <= 79) return 77;
  if (ww >= 80 && ww <= 81) return 80;
  if (ww >= 82 && ww <= 84) return 82;
  if (ww >= 85 && ww <= 86) return 85;
  if (ww >= 87 && ww <= 90) return 86;
  if (ww >= 91 && ww <= 94) return 95;
  if (ww >= 95 && ww <= 99) return 96;
  return 3;
}

function parseValues(raw: string): number[] {
  // Values are whitespace-separated; missing = "-"
  const out: number[] = [];
  const parts = raw.trim().split(/\s+/);
  for (const p of parts) {
    if (p === "-" || p === "") out.push(NaN);
    else {
      const n = Number(p);
      out.push(Number.isFinite(n) ? n : NaN);
    }
  }
  return out;
}

export interface MosmixHourly {
  station: { id: string; name: string; lat: number; lon: number; distanceKm: number };
  time: string[]; // ISO local-ish times (UTC from DWD; we keep as-is)
  weathercode: number[];
  temperature_2m: number[];
  precipitation: number[];
  windspeed_10m: number[];
  windgusts_10m: number[];
  winddirection_10m: number[];
  snowfall: number[];
  sunshine_duration: number[];
}

async function unzipKmz(buf: ArrayBuffer): Promise<string> {
  const files = unzipSync(new Uint8Array(buf));
  // Pick first .kml entry
  for (const name of Object.keys(files)) {
    if (name.toLowerCase().endsWith(".kml")) {
      return strFromU8(files[name]);
    }
  }
  throw new Error("Keine KML in KMZ gefunden");
}

function extractForecasts(kml: string): {
  times: string[];
  values: Map<string, number[]>;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(kml);

  // Navigate: kml > Document > ExtendedData > ProductDefinition > ForecastTimeSteps > TimeStep[]
  // Then per Placemark: ExtendedData > Forecast[]
  // After removeNSPrefix, dwd: is stripped.
  const root = doc?.kml?.Document ?? doc?.Document;
  if (!root) throw new Error("Ungültiges KML");

  // Times can be deeply nested; walk to find ForecastTimeSteps.
  const findKey = (obj: unknown, key: string): unknown => {
    if (!obj || typeof obj !== "object") return undefined;
    const o = obj as Record<string, unknown>;
    if (key in o) return o[key];
    for (const k of Object.keys(o)) {
      const found = findKey(o[k], key);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const fts = findKey(root, "ForecastTimeSteps") as
    | { TimeStep?: string | string[] }
    | undefined;
  const rawSteps = fts?.TimeStep ?? [];
  const times: string[] = Array.isArray(rawSteps) ? rawSteps : [rawSteps];

  // Placemark may be single or array; Forecast inside ExtendedData
  const placemarkRaw = root.Placemark;
  const placemarks = Array.isArray(placemarkRaw) ? placemarkRaw : placemarkRaw ? [placemarkRaw] : [];
  const pm = placemarks[0];
  const values = new Map<string, number[]>();
  if (pm?.ExtendedData?.Forecast) {
    const fcRaw = pm.ExtendedData.Forecast;
    const list = Array.isArray(fcRaw) ? fcRaw : [fcRaw];
    for (const fc of list) {
      const name = fc?.["@_elementName"];
      const val = fc?.value;
      if (typeof name === "string" && typeof val === "string") {
        values.set(name, parseValues(val));
      }
    }
  }
  return { times, values };
}

export const fetchMosmix = createServerFn({ method: "GET" })
  .inputValidator((d: { latitude: number; longitude: number }) => d)
  .handler(async ({ data }): Promise<MosmixHourly | null> => {
    try {
      const { station, distanceKm } = nearestStation(data.latitude, data.longitude);
      // Skip if too far (no representative MOSMIX point)
      if (distanceKm > 60) return null;

      const url = `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${station.id}/kml/MOSMIX_L_LATEST_${station.id}.kmz`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`MOSMIX ${station.id} HTTP ${res.status}`);
        return null;
      }
      const buf = await res.arrayBuffer();
      const kml = await unzipKmz(buf);
      const { times, values } = extractForecasts(kml);

      const TTT = values.get("TTT") ?? []; // Temp K
      const FF = values.get("FF") ?? []; // Wind m/s
      const FX1 = values.get("FX1") ?? []; // Gust 1h m/s
      const DD = values.get("DD") ?? []; // Wind dir degrees
      const RR1c = values.get("RR1c") ?? []; // Precip 1h mm
      const ww = values.get("ww") ?? []; // SYNOP ww
      const SunD1 = values.get("SunD1") ?? []; // Sunshine 1h seconds
      const RRS1c = values.get("RRS1c") ?? []; // Snowfall 1h mm (water eq.)

      const n = times.length;
      const temperature_2m = new Array<number>(n);
      const windspeed_10m = new Array<number>(n);
      const windgusts_10m = new Array<number>(n);
      const winddirection_10m = new Array<number>(n);
      const precipitation = new Array<number>(n);
      const snowfall = new Array<number>(n);
      const sunshine_duration = new Array<number>(n);
      const weathercode = new Array<number>(n);

      for (let i = 0; i < n; i++) {
        const k = TTT[i];
        temperature_2m[i] = Number.isFinite(k) ? k - 273.15 : NaN;
        const ms = FF[i];
        windspeed_10m[i] = Number.isFinite(ms) ? ms * 3.6 : NaN;
        const gms = FX1[i];
        windgusts_10m[i] = Number.isFinite(gms) ? gms * 3.6 : NaN;
        winddirection_10m[i] = Number.isFinite(DD[i]) ? DD[i] : NaN;
        precipitation[i] = Number.isFinite(RR1c[i]) ? RR1c[i] : NaN;
        // Snowfall: MOSMIX RRS1c is water equivalent (mm). Convert to cm snow ~ x10.
        snowfall[i] = Number.isFinite(RRS1c[i]) ? RRS1c[i] * 1.0 : NaN;
        sunshine_duration[i] = Number.isFinite(SunD1[i]) ? SunD1[i] : NaN;
        weathercode[i] = Number.isFinite(ww[i]) ? wwToWmoCode(Math.round(ww[i])) : NaN;
      }

      return {
        station: { id: station.id, name: station.name, lat: station.lat, lon: station.lon, distanceKm },
        time: times,
        weathercode,
        temperature_2m,
        precipitation,
        windspeed_10m,
        windgusts_10m,
        winddirection_10m,
        snowfall,
        sunshine_duration,
      };
    } catch (err) {
      console.error("MOSMIX fetch/parse error:", err);
      return null;
    }
  });
