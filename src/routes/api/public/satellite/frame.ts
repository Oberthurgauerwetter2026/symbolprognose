import { createFileRoute } from "@tanstack/react-router";

/**
 * Single-image satellite frame proxy.
 *
 * Statt im Browser pro Frame 4–9 WMS-Tiles zu laden, holt der Client
 * EIN GetMap-Bild pro Zeitstempel über diesen Endpunkt. Cloudflare cached
 * die Antwort am Edge (s-maxage), sodass identische Frames für andere
 * Nutzer praktisch instant ausgeliefert werden.
 *
 * Query:
 *   layer  WMS-Layer (Whitelist erzwungen, kein offener Proxy)
 *   time   ISO-Zeitstempel
 *   w,h    Bildmasse in Pixeln (auf 1600 max gecappt)
 *   west,south,east,north  Bbox in EPSG:4326 (lon/lat) — wird serverseitig
 *                          in EPSG:3857 Meter projiziert.
 */

const WMS_URL = "https://view.eumetsat.int/geoserver/wms";

// Whitelist aller in SATELLITE_REGIONS verwendeten Layer (inkl. Fallbacks).
const ALLOWED_LAYERS = new Set<string>([
  "mtg_hrfi:rgb_truecolour",
  "mtg_hrfi:rgb_geocolour",
  "mtg_hrfi:ir105",
  "mtg_fd:rgb_truecolour",
  "mtg_fd:rgb_geocolour",
  "mtg_fd:ir105_hrfi",
  "mumi:worldcloudmap_ir108",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const HALF_CIRCUMFERENCE = 20037508.342789244;

function lonToMercatorX(lon: number): number {
  return (lon * HALF_CIRCUMFERENCE) / 180;
}

function latToMercatorY(lat: number): number {
  // Mercator-Grenze bei ~85.05113°
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * (HALF_CIRCUMFERENCE / Math.PI);
}

function parseNum(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const Route = createFileRoute("/api/public/satellite/frame")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams;

        const layer = q.get("layer") ?? "";
        if (!ALLOWED_LAYERS.has(layer)) {
          return new Response("layer not allowed", { status: 400, headers: CORS_HEADERS });
        }

        const time = q.get("time") ?? "";
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time)) {
          return new Response("invalid time", { status: 400, headers: CORS_HEADERS });
        }

        const west = parseNum(q.get("west"));
        const south = parseNum(q.get("south"));
        const east = parseNum(q.get("east"));
        const north = parseNum(q.get("north"));
        if (
          west == null || south == null || east == null || north == null ||
          west >= east || south >= north ||
          west < -180 || east > 180 || south < -85.05 || north > 85.05
        ) {
          return new Response("invalid bbox", { status: 400, headers: CORS_HEADERS });
        }

        const w = Math.max(64, Math.min(1600, Math.floor(parseNum(q.get("w")) ?? 1024)));
        const h = Math.max(64, Math.min(1600, Math.floor(parseNum(q.get("h")) ?? 768)));

        const minx = lonToMercatorX(west);
        const maxx = lonToMercatorX(east);
        const miny = latToMercatorY(south);
        const maxy = latToMercatorY(north);

        const params = new URLSearchParams({
          service: "WMS",
          version: "1.3.0",
          request: "GetMap",
          layers: layer,
          styles: "",
          crs: "EPSG:3857",
          // WMS 1.3.0 EPSG:3857 expects minx,miny,maxx,maxy
          bbox: `${minx},${miny},${maxx},${maxy}`,
          width: String(w),
          height: String(h),
          format: "image/jpeg",
          transparent: "false",
          time,
        });

        const upstreamUrl = `${WMS_URL}?${params.toString()}`;

        let upstream: Response;
        try {
          upstream = await fetch(upstreamUrl, {
            headers: { Accept: "image/jpeg,image/png,*/*" },
          });
        } catch (err) {
          return new Response(`upstream fetch failed: ${(err as Error).message}`, {
            status: 502,
            headers: CORS_HEADERS,
          });
        }

        if (!upstream.ok || !upstream.body) {
          return new Response(`upstream ${upstream.status}`, {
            status: 502,
            headers: CORS_HEADERS,
          });
        }

        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        return new Response(upstream.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": contentType,
            // Edge cache aggressiv (Frame ist per (layer,time,bbox,size) unveränderlich)
            "Cache-Control": "public, max-age=600, s-maxage=3600, immutable",
          },
        });
      },
    },
  },
});
