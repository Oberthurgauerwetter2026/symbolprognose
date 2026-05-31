/**
 * Server-seitige SVG-Snapshots der Wetterkarten.
 * Dient als Fallback-Bild für Embeds, wenn JavaScript blockiert oder das
 * iframe vom Browser/Adblocker/In-App-Browser nicht geladen wird.
 * SVG: skaliert verlustfrei, klein, vom Browser nativ ohne JS gerendert.
 */
import thurgauData from "@/data/thurgau.json";
import { SPOTS, type Spot } from "@/data/spots";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

const THURGAU = thurgauData as unknown as FeatureCollection;
const BRAND = "#2561a1";

// Padding auf die Bounding-Box, damit Punkte am Rand nicht abgeschnitten werden
const PAD_LON = 0.04;
const PAD_LAT = 0.02;

// Sichtbares Fenster: Thurgau + leichter Puffer
const BBOX = {
  minLon: 8.667988 - PAD_LON,
  maxLon: 9.506947 + PAD_LON,
  minLat: 47.375915 - PAD_LAT,
  maxLat: 47.695405 + PAD_LAT,
};

const WIDTH = 1200;
const HEIGHT = Math.round(
  WIDTH *
    ((BBOX.maxLat - BBOX.minLat) / (BBOX.maxLon - BBOX.minLon)) *
    Math.cos(((BBOX.minLat + BBOX.maxLat) / 2) * (Math.PI / 180)),
);

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - BBOX.minLon) / (BBOX.maxLon - BBOX.minLon)) * WIDTH;
  // Mercator-light: cos(centerLat)-Faktor steckt bereits in HEIGHT
  const y =
    HEIGHT - ((lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * HEIGHT;
  return [x, y];
}

function ringToPath(ring: number[][]): string {
  if (ring.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function geometryToPath(geom: Polygon | MultiPolygon | null): string {
  if (!geom) return "";
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ringToPath).join(" ");
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates
      .map((poly) => poly.map(ringToPath).join(" "))
      .join(" ");
  }
  return "";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** WMO-Wettercode → kompaktes Glyph (Unicode, kein Font nötig). */
function weatherGlyph(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀" : "☾";
  if (code === 1 || code === 2) return isDay ? "⛅" : "☁";
  if (code === 3) return "☁";
  if (code === 45 || code === 48) return "≋";
  if (code >= 51 && code <= 67) return "☂";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 80 && code <= 82) return "☂";
  if (code >= 85 && code <= 86) return "❄";
  if (code >= 95) return "⚡";
  return "·";
}

type SpotForecast = {
  spot: Spot;
  temp: number | null;
  code: number;
  isDay: boolean;
};

async function fetchSpotForecast(spot: Spot): Promise<SpotForecast> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(spot.lat));
    url.searchParams.set("longitude", String(spot.lon));
    url.searchParams.set("models", "meteoswiss_icon_ch1");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("current", "temperature_2m,weathercode,is_day");
    const res = await fetch(url.toString(), {
      // Edge-Cache: bei wiederholtem Aufruf nicht erneut zum Origin
      cf: { cacheTtl: 600, cacheEverything: true } as unknown as RequestInit,
    } as RequestInit);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weathercode?: number; is_day?: number };
    };
    const c = data.current ?? {};
    return {
      spot,
      temp: typeof c.temperature_2m === "number" ? c.temperature_2m : null,
      code: typeof c.weathercode === "number" ? c.weathercode : 0,
      isDay: c.is_day === 1,
    };
  } catch {
    return { spot, temp: null, code: 0, isDay: true };
  }
}

function buildSvg({
  title,
  link,
  forecasts,
}: {
  title: string;
  link: string;
  forecasts: SpotForecast[];
}): string {
  const path = THURGAU.features
    .map((f) => geometryToPath(f.geometry as Polygon | MultiPolygon))
    .join(" ");

  const pinSize = 28;
  const pillW = 110;
  const pillH = 38;

  const pins = forecasts
    .map(({ spot, temp, code, isDay }) => {
      const [cx, cy] = project(spot.lon, spot.lat);
      const tempLabel = temp == null ? "—" : `${Math.round(temp)}°`;
      const glyph = weatherGlyph(code, isDay);
      const px = cx - pillW / 2;
      const py = cy - pillH - 8;
      return `
        <g>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${BRAND}" stroke="#fff" stroke-width="2"/>
          <g transform="translate(${px.toFixed(1)},${py.toFixed(1)})">
            <rect width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${BRAND}" stroke="rgba(255,255,255,0.4)"/>
            <text x="14" y="25" font-family="system-ui,sans-serif" font-size="20" fill="#fff">${escapeXml(glyph)}</text>
            <text x="42" y="16" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="rgba(255,255,255,0.85)" letter-spacing="0.5">${escapeXml(spot.name.toUpperCase().slice(0, 12))}</text>
            <text x="42" y="30" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">${escapeXml(tempLabel)}</text>
          </g>
        </g>`;
    })
    .join("");

  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <desc>Statisches Vorschau-Bild der ${escapeXml(title)}. Aktualisiert ${stamp}. Volle interaktive Karte: ${escapeXml(link)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eaf2fb"/>
      <stop offset="100%" stop-color="#cfe0f2"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <path d="${path}" fill="#ffffff" stroke="${BRAND}" stroke-width="2" stroke-linejoin="round" fill-opacity="0.85"/>
  ${pins}
  <g>
    <rect x="20" y="20" width="${Math.min(560, WIDTH - 40)}" height="56" rx="10" fill="${BRAND}"/>
    <text x="40" y="44" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#fff">${escapeXml(title)}</text>
    <text x="40" y="64" font-family="system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.85)">Vorschau · Stand ${stamp} · Tippen für interaktive Karte</text>
  </g>
</svg>`;
}

export async function buildRegionSnapshotSvg(): Promise<string> {
  const forecasts = await Promise.all(SPOTS.filter((s) => !s.minZoom).map(fetchSpotForecast));
  return buildSvg({
    title: "Wetterkarte Region Oberthurgau",
    link: "https://symbolprognose.lovable.app/karten/region",
    forecasts,
  });
}

export async function buildLokalSnapshotSvg(): Promise<string> {
  const forecasts = await Promise.all(SPOTS.map(fetchSpotForecast));
  return buildSvg({
    title: "Lokalprognose Oberthurgau",
    link: "https://symbolprognose.lovable.app/karten/lokal",
    forecasts,
  });
}

export function buildPlaceholderSnapshotSvg({
  title,
  link,
  note,
}: {
  title: string;
  link: string;
  note: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#eaf2fb"/>
  <g transform="translate(${WIDTH / 2},${HEIGHT / 2})">
    <rect x="-260" y="-60" width="520" height="120" rx="14" fill="${BRAND}"/>
    <text x="0" y="-10" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(title)}</text>
    <text x="0" y="20" font-family="system-ui,sans-serif" font-size="14" fill="rgba(255,255,255,0.9)" text-anchor="middle">${escapeXml(note)}</text>
    <text x="0" y="44" font-family="system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.75)" text-anchor="middle">${escapeXml(link)}</text>
  </g>
</svg>`;
}
