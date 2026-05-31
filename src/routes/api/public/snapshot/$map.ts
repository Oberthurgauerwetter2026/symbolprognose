import { createFileRoute } from "@tanstack/react-router";
import {
  buildLokalSnapshotSvg,
  buildPlaceholderSnapshotSvg,
  buildRegionSnapshotSvg,
} from "@/lib/snapshot.server";

const PUBLISHED = "https://symbolprognose.lovable.app";

/**
 * GET /api/public/snapshot/{map}.svg
 *
 * Liefert ein statisches SVG-Vorschau-Bild der jeweiligen Karte. Dient als
 * Fallback in Embeds, wenn JavaScript blockiert ist oder das iframe vom
 * Browser/Adblocker/In-App-Browser nicht geladen wird. Browser rendern SVG
 * nativ ohne JS — daher überall sichtbar.
 *
 * Cache-Control: 5 Minuten am Edge, 1 Minute im Browser. Stale-while-revalidate
 * deckt Open-Meteo-Latenzspitzen ab.
 */
export const Route = createFileRoute("/api/public/snapshot/$map")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = params.map;
        // .svg-Suffix entfernen, falls vorhanden
        const id = raw.replace(/\.svg$/i, "");

        let svg: string;
        switch (id) {
          case "region":
            svg = await buildRegionSnapshotSvg();
            break;
          case "lokal":
            svg = await buildLokalSnapshotSvg();
            break;
          case "radar":
            svg = buildPlaceholderSnapshotSvg({
              title: "Radar Oberthurgau",
              link: `${PUBLISHED}/karten/radar`,
              note: "Tippen für interaktive Niederschlagsanimation",
            });
            break;
          case "all":
            svg = await buildRegionSnapshotSvg();
            break;
          case "wind":
            svg = buildPlaceholderSnapshotSvg({
              title: "Wind-Animation",
              link: `${PUBLISHED}/karten/wind`,
              note: "Bald verfügbar — tippen für mehr",
            });
            break;
          case "pollen":
            svg = buildPlaceholderSnapshotSvg({
              title: "Pollenprognose",
              link: `${PUBLISHED}/karten/pollen`,
              note: "Bald verfügbar — tippen für mehr",
            });
            break;
          default:
            return new Response("Unknown map", { status: 404 });
        }

        return new Response(svg, {
          status: 200,
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control":
              "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
