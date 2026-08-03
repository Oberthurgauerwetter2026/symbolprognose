import { useEffect, useMemo, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { OBERTHURGAU_PLACES } from "@/data/oberthurgau-places";
import { REFERENCE_CITIES } from "@/data/reference-cities";

export { REFERENCE_CITIES };


const CITY_FONT =
  "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

function cityIcon(name: string, tier: "large" | "medium" | "local"): L.DivIcon {
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

import { useEffect, useState } from "react";

/**
 * Einheitliche Orts-Label für Karten im Standardfokus.
 * Kombiniert Referenzstädte (gross/medium) mit den Oberthurgau-Orten.
 */
export function CityMarkers() {
  const z = useMapZoom();

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; lat: number; lon: number; tier: "large" | "medium" | "local" }[] = [];

    const add = (
      name: string,
      lat: number,
      lon: number,
      tier: "large" | "medium" | "local",
    ) => {
      if (seen.has(name)) return;
      seen.add(name);
      out.push({ name, lat, lon, tier });
    };

    for (const c of REFERENCE_CITIES) {
      if (z >= c.minZoom) {
        add(c.name, c.lat, c.lon, c.tier);
      }
    }

    for (const p of OBERTHURGAU_PLACES) {
      if (z >= (p.minZoom ?? 10.5)) {
        add(p.name, p.lat, p.lon, "local");
      }
    }

    return out;
  }, [z]);

  return (
    <>
      {items.map((c) => (
        <Marker
          key={c.name}
          position={[c.lat, c.lon]}
          icon={cityIcon(c.name, c.tier)}
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}
