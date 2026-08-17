/**
 * Server-seitige SVG-Standbilder für Radar, Wind und Warnungen.
 *
 * Zweck: WordPress-Widgets, die kein iframe und kein JavaScript brauchen.
 * Das Bild wird per <img src="/api/public/snapshot/radar.svg"> eingebunden,
 * ist verlinkbar und rendert überall (Adblocker, In-App-Browser, RSS).
 */
import thurgauData from "@/data/thurgau.json";
import regionData from "@/data/region.json";
import { SPOTS } from "@/data/spots";
import { REFERENCE_CITIES } from "@/data/reference-cities";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { LEVELS, slugifyRegion, zurichTime } from "@/lib/warnings-config";
import { readActiveWarnings } from "@/lib/warnings.server";
import { r2ObjectUrlCandidates } from "@/lib/r2-url.server";

const BRAND = "#2561a1";
const PUBLISHED = "https://oberthurgauer-wetter.lovable.app";

type Bbox = { minLon: number; maxLon: number; minLat: number; maxLat: number };

/** Weiter Ausschnitt für Radar/Wind (Oberthurgau + Bodensee + Umland). */
const WIDE: Bbox = { minLon: 8.55, maxLon: 9.85, minLat: 47.25, maxLat: 47.85 };
/** Enger Ausschnitt für die Warnkarte (nur Oberthurgau-Gemeinden). */
const OBERTHURGAU: Bbox = bboxOf(regionData as unknown as FeatureCollection, 0.02, 0.012);

const WIDTH = 1200;

function bboxOf(fc: FeatureCollection, padLon: number, padLat: number): Bbox {
  let minLon = 180;
  let maxLon = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const f of fc.features) {
    for (const ring of ringsOf(f.geometry as Polygon | MultiPolygon | null)) {
      for (const [x, y] of ring) {
        if (x < minLon) minLon = x;
        if (x > maxLon) maxLon = x;
        if (y < minLat) minLat = y;
        if (y > maxLat) maxLat = y;
      }
    }
  }
  return {
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
  };
}

function ringsOf(geom: Polygon | MultiPolygon | null): Position[][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates as Position[][];
  if (geom.type === "MultiPolygon")
    return (geom.coordinates as Position[][][]).flatMap((p) => p);
  return [];
}

type Proj = {
  width: number;
  height: number;
  project: (lon: number, lat: number) => [number, number];
};

function makeProj(bbox: Bbox, width = WIDTH): Proj {
  const height = Math.round(
    width *
      ((bbox.maxLat - bbox.minLat) / (bbox.maxLon - bbox.minLon)) *
      Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180)),
  );
  return {
    width,
    height,
    project: (lon, lat) => [
      ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * width,
      height - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * height,
    ],
  };
}

function ringPath(ring: Position[], proj: Proj): string {
  if (!ring.length) return "";
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = proj.project(ring[i][0], ring[i][1]);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function geomPath(geom: Polygon | MultiPolygon | null, proj: Proj): string {
  return ringsOf(geom)
    .map((r) => ringPath(r, proj))
    .join(" ");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Einheitlicher Rahmen: Titelpille oben links, Fusszeile mit Quelle + Stand. */
function frame({
  proj,
  title,
  subtitle,
  source,
  body,
  ariaLabel,
  defs = "",
}: {
  proj: Proj;
  title: string;
  subtitle: string;
  source: string;
  body: string;
  ariaLabel: string;
  defs?: string;
}): string {
  const { width: W, height: H } = proj;
  const titleW = Math.min(680, W - 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(ariaLabel)}">
  <title>${esc(title)}</title>
  <desc>${esc(ariaLabel)} — Standbild, aktualisiert ${esc(subtitle)}. Interaktiv: ${PUBLISHED}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eaf2fb"/>
      <stop offset="100%" stop-color="#cfe0f2"/>
    </linearGradient>
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${body}
  <g>
    <rect x="20" y="20" width="${titleW}" height="58" rx="10" fill="${BRAND}"/>
    <text x="40" y="45" font-family="system-ui,sans-serif" font-size="21" font-weight="700" fill="#fff">${esc(title)}</text>
    <text x="40" y="65" font-family="system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.88)">${esc(subtitle)}</text>
  </g>
  <g>
    <rect x="20" y="${H - 46}" width="${Math.min(760, W - 40)}" height="30" rx="8" fill="rgba(255,255,255,0.82)"/>
    <text x="34" y="${H - 26}" font-family="system-ui,sans-serif" font-size="12" fill="#334155">${esc(source)}</text>
  </g>
</svg>`;
}

/* -------------------------------- Basiskarte ------------------------------- */

function baseLayers(proj: Proj, opts: { strong?: boolean } = {}): string {
  const tg = thurgauData as unknown as FeatureCollection;
  const path = tg.features.map((f) => geomPath(f.geometry as Polygon | MultiPolygon, proj)).join(" ");
  return `<path d="${path}" fill="${opts.strong ? "#ffffff" : "none"}" fill-opacity="${opts.strong ? 0.35 : 0}" stroke="${BRAND}" stroke-width="2" stroke-linejoin="round"/>`;
}

function cityDots(proj: Proj, bbox: Bbox): string {
  const items = [
    ...REFERENCE_CITIES.filter((c) => c.tier === "large" || c.tier === "medium").map((c) => ({
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      big: c.tier === "large",
    })),
    ...SPOTS.filter((s) => !s.minZoom).map((s) => ({ name: s.name, lat: s.lat, lon: s.lon, big: false })),
  ].filter(
    (c) =>
      c.lon > bbox.minLon + 0.02 &&
      c.lon < bbox.maxLon - 0.02 &&
      c.lat > bbox.minLat + 0.01 &&
      c.lat < bbox.maxLat - 0.01,
  );

  return items
    .map((c) => {
      const [x, y] = proj.project(c.lon, c.lat);
      const r = c.big ? 4.5 : 3.5;
      const fs = c.big ? 15 : 13;
      return `<g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#1f2937" stroke="#ffffff" stroke-width="1.6"/>
        <text x="${(x + r + 5).toFixed(1)}" y="${(y + 5).toFixed(1)}" font-family="system-ui,sans-serif" font-size="${fs}" font-weight="600" fill="#111827" stroke="#ffffff" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke">${esc(c.name)}</text>
      </g>`;
    })
    .join("");
}

/* --------------------------------- Radar ---------------------------------- */

type RadarManifest = {
  bbox: Bbox;
  generatedAt?: string;
  frames: { t: string; precipUrl?: string }[];
};

async function fetchRadarManifest(): Promise<RadarManifest | null> {
  const candidates = [
    ...r2ObjectUrlCandidates(process.env.RADAR_MANIFEST_URL, "radar/frames.json"),
    ...r2ObjectUrlCandidates(process.env.RADAR_R2_PUBLIC_URL, "radar/frames.json"),
    ...r2ObjectUrlCandidates(process.env.R2_PUBLIC_URL, "radar/frames.json"),
  ].filter((u, i, a) => a.indexOf(u) === i);
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cf: { cacheTtl: 60 } as unknown as undefined } as RequestInit);
      if (!res.ok) continue;
      const json = (await res.json()) as RadarManifest;
      if (json?.bbox && Array.isArray(json.frames)) return json;
    } catch {
      /* nächste Kandidaten-URL */
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fetchPngDataUrl(rawUrl: string): Promise<string | null> {
  const urls: string[] = [];
  if (/^https?:\/\//i.test(rawUrl)) urls.push(rawUrl);
  const m = rawUrl.match(/(radar\/[A-Za-z0-9._\-/]+\.png)/i);
  if (m) {
    for (const env of [process.env.RADAR_MANIFEST_URL, process.env.RADAR_R2_PUBLIC_URL, process.env.R2_PUBLIC_URL]) {
      for (const u of r2ObjectUrlCandidates(env, m[1])) if (!urls.includes(u)) urls.push(u);
    }
  }
  for (const u of urls) {
    try {
      const res = await fetch(u, { cf: { cacheTtl: 300 } as unknown as undefined } as RequestInit);
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 100) continue;
      return `data:image/png;base64,${bytesToBase64(buf)}`;
    } catch {
      /* nächste URL */
    }
  }
  return null;
}

const MAX_FRAME_AGE_MS = 6 * 60 * 60_000;

export async function buildRadarSnapshotSvg(): Promise<string> {
  const proj = makeProj(WIDE);
  const manifest = await fetchRadarManifest();
  const now = Date.now();

  const latest = (manifest?.frames ?? [])
    .filter((f) => f.precipUrl && Number.isFinite(Date.parse(f.t)))
    .filter((f) => now - Date.parse(f.t) <= MAX_FRAME_AGE_MS)
    .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0];

  let imageLayer = "";
  let stampLabel = "Messung derzeit nicht verfügbar";

  if (latest && manifest) {
    const dataUrl = await fetchPngDataUrl(latest.precipUrl!);
    if (dataUrl) {
      const b = manifest.bbox;
      const [x0, y0] = proj.project(b.minLon, b.maxLat);
      const [x1, y1] = proj.project(b.maxLon, b.minLat);
      imageLayer = `<g clip-path="url(#clipView)">
        <image href="${dataUrl}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" preserveAspectRatio="none" opacity="0.9"/>
      </g>`;
      stampLabel = `Radarmessung ${zurichTime(latest.t)}`;
    }
  }

  const legend = precipLegend(proj);

  return frame({
    proj,
    title: "Niederschlagsradar Oberthurgau",
    subtitle: `${stampLabel} · Standbild`,
    source: "Quelle: MeteoSchweiz CombiPrecip (OGD) · oberthurgauerwetter.ch",
    ariaLabel: "Niederschlagsradar Region Oberthurgau",
    defs: `<clipPath id="clipView"><rect x="0" y="0" width="${proj.width}" height="${proj.height}"/></clipPath>`,
    body: `${imageLayer}${baseLayers(proj)}${cityDots(proj, WIDE)}${legend}`,
  });
}

/** Kompakte Farbskala mm/h, gleiche Bänder wie die interaktive Karte. */
function precipLegend(proj: Proj): string {
  const bands: [string, string][] = [
    ["#a5f2f3", "0.1"],
    ["#3fb1e3", "1"],
    ["#2b6fd1", "3"],
    ["#63c46b", "5"],
    ["#f2d347", "10"],
    ["#ef8b30", "20"],
    ["#d63b32", "40"],
    ["#8f2ea8", "60+"],
  ];
  const w = 46;
  const h = 16;
  const x0 = proj.width - 20 - bands.length * w;
  const y0 = 24;
  const cells = bands
    .map(([c, label], i) => {
      const x = x0 + i * w;
      return `<rect x="${x}" y="${y0}" width="${w}" height="${h}" fill="${c}"/>
      <text x="${x + w / 2}" y="${y0 + h + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#1f2937" stroke="#ffffff" stroke-width="3" paint-order="stroke">${label}</text>`;
    })
    .join("");
  return `<g>
    <rect x="${x0 - 10}" y="${y0 - 8}" width="${bands.length * w + 20}" height="${h + 34}" rx="8" fill="rgba(255,255,255,0.8)"/>
    ${cells}
    <text x="${x0}" y="${y0 - 12}" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#334155">mm/h</text>
  </g>`;
}

/* ---------------------------------- Wind ---------------------------------- */

type WindPoint = { name: string; lat: number; lon: number; speed: number | null; gust: number | null; dir: number | null };

async function fetchWindPoints(): Promise<WindPoint[]> {
  const pts = [
    ...SPOTS.filter((s) => !s.minZoom).map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
    ...REFERENCE_CITIES.filter((c) =>
      c.lon > WIDE.minLon + 0.05 && c.lon < WIDE.maxLon - 0.05 && c.lat > WIDE.minLat + 0.03 && c.lat < WIDE.maxLat - 0.03,
    ).map((c) => ({ name: c.name, lat: c.lat, lon: c.lon })),
  ];
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", pts.map((p) => p.lat).join(","));
    url.searchParams.set("longitude", pts.map((p) => p.lon).join(","));
    url.searchParams.set("models", "meteoswiss_icon_ch1");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("current", "wind_speed_10m,wind_gusts_10m,wind_direction_10m");
    const res = await fetch(url.toString(), {
      cf: { cacheTtl: 600, cacheEverything: true } as unknown as undefined,
    } as RequestInit);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as unknown;
    const arr = Array.isArray(json) ? json : [json];
    return pts.map((p, i) => {
      const c = (arr[i] as { current?: Record<string, number> } | undefined)?.current ?? {};
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      return {
        ...p,
        speed: num(c["wind_speed_10m"]),
        gust: num(c["wind_gusts_10m"]),
        dir: num(c["wind_direction_10m"]),
      };
    });
  } catch (err) {
    console.error("[snapshot-wind] fetch failed", err);
    return pts.map((p) => ({ ...p, speed: null, gust: null, dir: null }));
  }
}

function windColor(kmh: number): string {
  if (kmh < 10) return "#7dd3fc";
  if (kmh < 20) return "#38bdf8";
  if (kmh < 35) return "#22c55e";
  if (kmh < 50) return "#f2c53d";
  if (kmh < 70) return "#ef8b30";
  return "#d63b32";
}

export async function buildWindSnapshotSvg(): Promise<string> {
  const proj = makeProj(WIDE);
  const points = await fetchWindPoints();

  const arrows = points
    .map((p) => {
      const [x, y] = proj.project(p.lon, p.lat);
      const gust = p.gust ?? p.speed;
      const color = windColor(gust ?? 0);
      // Windrichtung = Herkunft; der Pfeil zeigt in die Bewegungsrichtung.
      const rot = (p.dir ?? 0) + 180;
      const arrow =
        p.dir == null
          ? `<circle cx="0" cy="0" r="4" fill="${color}" stroke="#0f172a" stroke-width="1.2"/>`
          : `<g transform="rotate(${rot.toFixed(0)})">
              <path d="M0,-19 L7,7 L0,2 L-7,7 Z" fill="${color}" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
            </g>`;
      const label = gust == null ? "—" : `${Math.round(gust)}`;
      return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
        ${arrow}
        <text x="0" y="30" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#0f172a" stroke="#ffffff" stroke-width="3.4" paint-order="stroke">${label}</text>
        <text x="0" y="45" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#334155" stroke="#ffffff" stroke-width="3" paint-order="stroke">${esc(p.name)}</text>
      </g>`;
    })
    .join("");

  return frame({
    proj,
    title: "Wind & Böenspitzen Oberthurgau",
    subtitle: `Böen in km/h · Stand ${zurichTime(new Date().toISOString())} · Standbild`,
    source: "Quelle: MeteoSchweiz ICON-CH1 via Open-Meteo · oberthurgauerwetter.ch",
    ariaLabel: "Windkarte Region Oberthurgau mit Böenspitzen",
    body: `${baseLayers(proj, { strong: true })}${arrows}`,
  });
}

/* -------------------------------- Warnungen ------------------------------- */

export async function buildWarnSnapshotSvg(): Promise<string> {
  const proj = makeProj(OBERTHURGAU, 1000);
  const fc = regionData as unknown as FeatureCollection;

  let warnings: Awaited<ReturnType<typeof readActiveWarnings>> = [];
  try {
    warnings = await readActiveWarnings();
  } catch (err) {
    console.error("[snapshot-warn] read failed", err);
  }

  type Top = { level: number; advisory: boolean; title: string };
  const byRegion = new Map<string, Top>();
  for (const w of warnings) {
    for (const rid of w.regionIds) {
      const prev = byRegion.get(rid);
      const cand: Top = {
        level: Math.max(0, Math.min(3, w.level)),
        advisory: !!w.advisory,
        title: w.title ?? "",
      };
      if (!prev || cand.level > prev.level) byRegion.set(rid, cand);
    }
  }

  const shapes = fc.features
    .map((f) => {
      const name = String((f.properties as { name?: string } | null)?.name ?? "");
      if (!name) return "";
      const id = slugifyRegion(name);
      const top = byRegion.get(id);
      const lvl = (top?.level ?? 0) as 0 | 1 | 2 | 3;
      const def = LEVELS[lvl];
      const d = geomPath(f.geometry as Polygon | MultiPolygon, proj);
      const hatch = top?.advisory ? `<path d="${d}" fill="url(#hatch)" stroke="none"/>` : "";
      return `<g>
        <path d="${d}" fill="${def.color}" fill-opacity="${def.fillOpacity}" stroke="#ffffff" stroke-width="1.4"/>
        ${hatch}
      </g>`;
    })
    .join("");

  const labels = fc.features
    .map((f) => {
      const name = String((f.properties as { name?: string } | null)?.name ?? "");
      if (!name) return "";
      const rings = ringsOf(f.geometry as Polygon | MultiPolygon);
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const r of rings)
        for (const [x, y] of r) {
          sx += x;
          sy += y;
          n++;
        }
      if (!n) return "";
      const [x, y] = proj.project(sx / n, sy / n);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#111827" stroke="#ffffff" stroke-width="3.2" paint-order="stroke">${esc(name)}</text>`;
    })
    .join("");

  const active = warnings.length;
  const maxLevel = warnings.reduce((m, w) => Math.max(m, w.level), 0);
  const subtitle =
    active === 0
      ? `Keine aktiven Warnungen · Stand ${zurichTime(new Date().toISOString())}`
      : `${active} aktive Warnung${active === 1 ? "" : "en"} · höchste Stufe ${maxLevel} · Stand ${zurichTime(new Date().toISOString())}`;

  return frame({
    proj,
    title: "Wetterwarnungen Oberthurgau",
    subtitle: `${subtitle} · Standbild`,
    source: "Quelle: eigene Warnlage nach MeteoSchweiz-Kriterien · oberthurgauerwetter.ch",
    ariaLabel: "Warnkarte der Gemeinden im Oberthurgau",
    defs: `<pattern id="hatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" stroke-width="3" stroke-opacity="0.75"/>
    </pattern>`,
    body: `${shapes}${warnLegend(proj)}${labels}`,
  });
}

function warnLegend(proj: Proj): string {
  const items: { color: string; label: string; hatch?: boolean }[] = [
    { color: LEVELS[0].color, label: "Keine Gefahr" },
    { color: LEVELS[1].color, label: "Vorinformation", hatch: true },
    { color: LEVELS[1].color, label: "Stufe 1" },
    { color: LEVELS[2].color, label: "Stufe 2" },
    { color: LEVELS[3].color, label: "Stufe 3" },
  ];
  const x0 = 24;
  const y0 = proj.height - 90;
  const rows = items
    .map((it, i) => {
      const y = y0 + i * 22;
      return `<rect x="${x0}" y="${y}" width="18" height="14" fill="${it.color}" fill-opacity="0.8" stroke="#ffffff"/>
      ${it.hatch ? `<rect x="${x0}" y="${y}" width="18" height="14" fill="url(#hatch)"/>` : ""}
      <text x="${x0 + 26}" y="${y + 12}" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#111827">${esc(it.label)}</text>`;
    })
    .join("");
  return `<g>
    <rect x="${x0 - 10}" y="${y0 - 10}" width="170" height="${items.length * 22 + 16}" rx="8" fill="rgba(255,255,255,0.85)"/>
    ${rows}
  </g>`;
}
