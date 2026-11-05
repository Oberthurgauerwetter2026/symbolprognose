import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type City = { name: string; lat: number; lon: number; left?: boolean; dy?: number };

const ALPS: City[] = [
  { name: "Zürich", lat: 47.377, lon: 8.54 },
  { name: "Bern", lat: 46.948, lon: 7.447 },
  { name: "Basel", lat: 47.559, lon: 7.588 },
  { name: "Genf", lat: 46.204, lon: 6.143 },
  { name: "Lugano", lat: 46.004, lon: 8.951 },
  { name: "St. Gallen", lat: 47.424, lon: 9.377, dy: -9 },
  { name: "Luzern", lat: 47.05, lon: 8.309 },
  { name: "Chur", lat: 46.85, lon: 9.532 },
  { name: "Bregenz", lat: 47.503, lon: 9.747, dy: 4 },
  { name: "Innsbruck", lat: 47.269, lon: 11.404 },
  { name: "München", lat: 48.137, lon: 11.575 },
  { name: "Mailand", lat: 45.464, lon: 9.19 },
  { name: "Stuttgart", lat: 48.776, lon: 9.183 },
];

const EUROPE: City[] = [
  { name: "Berlin", lat: 52.52, lon: 13.405 },
  { name: "Paris", lat: 48.857, lon: 2.352 },
  { name: "Rom", lat: 41.903, lon: 12.496 },
  { name: "Wien", lat: 48.208, lon: 16.373 },
  { name: "Madrid", lat: 40.417, lon: -3.704 },
  { name: "London", lat: 51.507, lon: -0.128 },
  { name: "Zürich", lat: 47.377, lon: 8.54 },
];

const LABEL_STYLE =
  "font:600 11px/1 'SF Pro Display',Inter,system-ui,sans-serif;color:#fff;white-space:nowrap;" +
  "text-shadow:0 0 2px #000,0 0 3px #000,0 1px 2px rgba(0,0,0,.9);display:flex;align-items:center;gap:4px;";
const DOT_STYLE =
  "width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.75);flex:none;";

export function SatelliteCities({ europe }: { europe: boolean }) {
  const map = useMap();
  useEffect(() => {
    const group = L.layerGroup();
    for (const c of europe ? EUROPE : ALPS) {
      const icon = L.divIcon({
        className: "",
        iconSize: [0, 0],
        iconAnchor: [2.5, 2.5],
        html: c.left
          ? `<div style="${LABEL_STYLE}transform:translateX(calc(-100% + 5px));flex-direction:row-reverse"><span style="${DOT_STYLE}"></span>${c.name}</div>`
          : `<div style="${LABEL_STYLE}transform:translateY(${c.dy ?? 0}px)"><span style="${DOT_STYLE}"></span>${c.name}</div>`,
      });
      L.marker([c.lat, c.lon], { icon, interactive: false, keyboard: false }).addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, europe]);
  return null;
}
