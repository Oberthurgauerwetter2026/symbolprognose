// DWD MOSMIX-L server function.
// Fetches hourly forecast for the closest MOSMIX station (KMZ → KML → normalized HourlyData).
// Used as additional source from day 6 onward in fetchForecast().

import { createServerFn } from "@tanstack/react-start";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

// Curated MOSMIX-L stations across CH and adjacent regions.
// IDs are DWD MOSMIX station IDs (WMO-style numeric codes).
const MOSMIX_STATIONS: { id: string; name: string; lat: number; lon: number }[] = [
  { id: "06610", name: "Sion", lat: 46.22, lon: 7.33 },
  { id: "06631", name: "Pully", lat: 46.51, lon: 6.67 },
  { id: "06632", name: "Payerne", lat: 46.81, lon: 6.94 },
  { id: "06660", name: "Basel-Binningen", lat: 47.54, lon: 7.58 },
  { id: "06670", name: "Luzern", lat: 47.04, lon: 8.30 },
  { id: "06680", name: "Zürich-Kloten", lat: 47.48, lon: 8.54 },
  { id: "06700", name: "Genève-Cointrin", lat: 46.25, lon: 6.13 },
  { id: "06720", name: "St. Gallen", lat: 47.43, lon: 9.40 },
  { id: "06770", name: "Lugano", lat: 46.00, lon: 8.96 },
  { id: "06780", name: "Samedan", lat: 46.53, lon: 9.88 },
  { id: "06790", name: "Glarus", lat: 47.03, lon: 9.07 },
  { id: "06792", name: "Altdorf", lat: 46.87, lon: 8.62 },
  { id: "06810", name: "Säntis", lat: 47.25, lon: 9.34 },
  // Nearby D / A / F / I stations for border regions
  { id: "10836", name: "Friedrichshafen", lat: 47.67, lon: 9.51 },
  { id: "10929", name: "Konstanz", lat: 47.68, lon: 9.19 },
  { id: "11120", name: "Innsbruck", lat: 47.26, lon: 11.36 },
  { id: "16080", name: "Milano-Malpensa", lat: 45.62, lon: 8.73 },
  { id: "07480", name: "Lyon-Bron", lat: 45.73, lon: 4.94 },
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
