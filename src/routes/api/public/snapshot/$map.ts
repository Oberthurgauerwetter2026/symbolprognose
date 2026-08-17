import { createFileRoute } from "@tanstack/react-router";
import {
  buildLokalSnapshotSvg,
  buildPlaceholderSnapshotSvg,
  buildRegionSnapshotSvg,
} from "@/lib/snapshot.server";
import {
  buildRadarSnapshotSvg,
  buildWarnSnapshotSvg,
  buildWindSnapshotSvg,
} from "@/lib/snapshot-maps.server";


const PUBLISHED = "https://oberthurgauer-wetter.lovable.app";

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
            try {
              svg = await buildRadarSnapshotSvg();
            } catch (err) {
              console.error("[snapshot] radar failed", err);
              svg = buildPlaceholderSnapshotSvg({
                title: "Niederschlagsradar Oberthurgau",
                link: `${PUBLISHED}/karten/radar`,
                note: "Messung derzeit nicht verfügbar — tippen für die interaktive Karte",
              });
            }
            break;
          case "all":
            svg = await buildRegionSnapshotSvg();
            break;
          case "wind":
            try {
              svg = await buildWindSnapshotSvg();
            } catch (err) {
              console.error("[snapshot] wind failed", err);
              svg = buildPlaceholderSnapshotSvg({
                title: "Wind & Böenspitzen Oberthurgau",
                link: `${PUBLISHED}/karten/wind`,
                note: "Winddaten derzeit nicht verfügbar — tippen für die interaktive Karte",
              });
            }
            break;
          case "warnungen":
          case "warnkarte":
            try {
              svg = await buildWarnSnapshotSvg();
            } catch (err) {
              console.error("[snapshot] warnungen failed", err);
              svg = buildPlaceholderSnapshotSvg({
                title: "Wetterwarnungen Oberthurgau",
                link: `${PUBLISHED}/warnkarte`,
                note: "Warnlage derzeit nicht abrufbar — tippen für die interaktive Karte",
              });
            }
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
