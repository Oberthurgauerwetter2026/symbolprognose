import { useEffect, useMemo, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { OBERTHURGAU_PLACES } from "@/data/oberthurgau-places";
import { REFERENCE_CITIES, REFERENCE_PEAKS } from "@/data/reference-cities";
import {
  cityLabelWidth,
  declutterLabels,
  peakLabelWidth,
  PEAK_ANCHOR_X,
  PEAK_ANCHOR_Y,
  type DeclutterCandidate,
} from "./label-declutter";

export { REFERENCE_CITIES };


const CITY_FONT =
  "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

type Tier = "large" | "medium" | "local";

type Label = {
  name: string;
  lat: number;
  lon: number;
  tier: Tier;
  kind: "city" | "peak";
  elev?: number;
  /** Versatz des Namens in CSS-Pixeln (nur Gipfel). */
  dx?: number;
  dy?: number;
};

function cityIcon(name: string, tier: Tier): L.DivIcon {
  const isLarge = tier === "large";
  const isMedium = tier === "medium";

  const bulletSize = isLarge ? 16 : isMedium ? 14 : 12;
  const bulletWeight = 700;
  const labelSize = isLarge ? 13 : isMedium ? 12 : 11;
  const labelWeight = isLarge ? 700 : isMedium ? 600 : 500;

  const bulletColor = "#2561a1";
  const labelColor = isLarge ? "#111827" : "#1a1a1a";

  const shadow =
    "text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff;";

  const bullet =
    `font:${bulletWeight} ${bulletSize}px/1 ${CITY_FONT};color:${bulletColor};${shadow}line-height:1;margin-right:4px;vertical-align:middle;`;
  const label =
    `font:${labelWeight} ${labelSize}px/1 ${CITY_FONT};color:${labelColor};${shadow}white-space:nowrap;vertical-align:middle;`;

  return L.divIcon({
    className: "city-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function useMapZoom(): number {
  const map = useMap();
  const [z, setZ] = useState<number>(() => map.getZoom());
  useEffect(() => {
    const update = () => setZ(map.getZoom());
    map.on("zoomend zoom", update);
    update();
    return () => {
      map.off("zoomend zoom", update);
    };
  }, [map]);
  return z;
}

/**
 * Einheitliche Orts-Label für Karten im Standardfokus.
 * Kombiniert Referenzstädte (gross/medium), Gipfel und die Oberthurgau-Orte
 * und lässt Namen weg, die sonst übereinanderliegen würden.
 */
export function CityMarkers() {
  const z = useMapZoom();

  const labels = useMemo<Label[]>(() => {
    const seen = new Set<string>();
    const out: DeclutterCandidate<Label>[] = [];

    const add = (
      name: string,
      lat: number,
      lon: number,
      tier: Tier,
      kind: Label["kind"],
      priority: number,
      width: number,
      elev?: number,
      dx?: number,
      dy?: number,
    ) => {
      if (seen.has(name)) return;
      seen.add(name);
      out.push({
        item: { name, lat, lon, tier, kind, elev, dx, dy },
        lat,
        lon,
        width,
        priority,
        anchorX: kind === "peak" ? PEAK_ANCHOR_X + (dx ?? 0) : undefined,
        anchorY: kind === "peak" ? PEAK_ANCHOR_Y + (dy ?? 0) : undefined,
      });
    };

    for (const c of REFERENCE_CITIES) {
      if (z >= c.minZoom) {
        add(
          c.name,
          c.lat,
          c.lon,
          c.tier,
          "city",
          c.tier === "large" ? 0 : 1,
          cityLabelWidth(c.name, c.tier),
        );
      }
    }

    for (const p of REFERENCE_PEAKS) {
      if (z >= p.minZoom) {
        add(
          p.name,
          p.lat,
          p.lon,
          "local",
          "peak",
          2,
          peakLabelWidth(p.name, p.elev),
          p.elev,
          p.labelDx,
          p.labelDy,
        );
      }
    }

    for (const p of OBERTHURGAU_PLACES) {
      if (z >= (p.minZoom ?? 10.5)) {
        add(
          p.name,
          p.lat,
          p.lon,
          "local",
          "city",
          3,
          cityLabelWidth(p.name, "local"),
        );
      }
    }

    return declutterLabels(out, z);
  }, [z]);

  return (
    <>
      {labels.map((c) =>
        c.kind === "peak" ? (
          <Marker
            key={`peak-${c.name}`}
            position={[c.lat, c.lon]}
            icon={peakIcon(c.name, c.elev ?? 0, c.dx ?? 0, c.dy ?? 0)}
            interactive={false}
            keyboard={false}
          />
        ) : (
          <Marker
            key={c.name}
            position={[c.lat, c.lon]}
            icon={cityIcon(c.name, c.tier)}
            interactive={false}
            keyboard={false}
          />
        ),
      )}
    </>
  );
}

function peakIcon(name: string, elev: number, dx = 0, dy = 0): L.DivIcon {
  const shadow = "text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff;";
  const tri = `font:700 11px/1 ${CITY_FONT};color:#6b3f1d;${shadow}margin-right:3px;`;
  const label = `font:italic 600 11px/1 ${CITY_FONT};color:#4a2c14;${shadow}white-space:nowrap;`;
  const sub = `font:500 10px/1 ${CITY_FONT};color:#6b4a2e;${shadow}margin-left:3px;`;
  return L.divIcon({
    className: "peak-marker",
    html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(${PEAK_ANCHOR_X + dx}px,${PEAK_ANCHOR_Y + dy}px);"><span style="${tri}">▲</span><span style="${label}">${name}</span><span style="${sub}">${elev}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
