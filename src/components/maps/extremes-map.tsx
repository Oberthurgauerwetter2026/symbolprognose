import { useEffect } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import lake from "@/data/lake.json";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExtremeStat, StationExtreme } from "@/lib/station-extremes";
import { formatStationValue } from "@/lib/station-extremes";

const BOUNDS: L.LatLngBoundsExpression = [[47.477, 9.158], [47.641, 9.467]];

function Fit({ generousPadding }: { generousPadding: boolean }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      const small = map.getSize().x <= 480;
      map.fitBounds(BOUNDS, {
        paddingTopLeft: small ? [generousPadding ? 48 : 20, 35] : [36, 36],
        paddingBottomRight: small ? [generousPadding ? 48 : 20, 18] : [36, 36],
        animate: false,
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, generousPadding]);
  return null;
}

// Gleiche Farbskala und Pillen wie die Live-Karte im Weather Hub.
const STOPS: [number, string][] = [[-30,"#0f1020"],[-27,"#13172f"],[-24,"#181e3f"],[-21,"#1c254e"],[-18,"#212c5e"],[-15,"#25336d"],[-12,"#2a3a7d"],[-9,"#2e418c"],[-6,"#33489c"],[-3,"#3a55b5"],[0,"#4169c9"],[3,"#3690d0"],[6,"#2f9dd0"],[9,"#3fbec2"],[12,"#44c47e"],[15,"#80ce62"],[18,"#bcd84a"],[21,"#f0dc3a"],[24,"#efc551"],[27,"#ed9a28"],[30,"#ea7826"],[33,"#e35a2a"],[36,"#d83a33"],[39,"#b82c2a"],[42,"#8e2020"]];
const h2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const GUST_STOPS: [number, string][] = [[0,"#44c47e"],[20,"#80ce62"],[40,"#f0dc3a"],[60,"#ed9a28"],[80,"#d83a33"],[100,"#8e2020"],[130,"#71369b"]];
const RAIN_STOPS: [number, string][] = [[0,"#e2e8f0"],[1,"#a9cfe9"],[5,"#3690d0"],[15,"#4169c9"],[30,"#33489c"],[60,"#71369b"],[100,"#b82c2a"]];
function color(v: number, stat: ExtremeStat): string {
  const stops = stat === "gust" ? GUST_STOPS : stat === "rain" ? RAIN_STOPS : STOPS;
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [av, ac] = stops[i], [bv, bc] = stops[i + 1];
    if (v <= bv) {
      const t = (v - av) / (bv - av), c = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
      return "#" + [1, 3, 5].map((o) => h2(c(ac, o) + (c(bc, o) - c(ac, o)) * t)).join("");
    }
  }
  return stops[stops.length - 1][1];
}
const contrast = (bg: string) => (0.299 * parseInt(bg.slice(1, 3), 16) + 0.587 * parseInt(bg.slice(3, 5), 16) + 0.114 * parseInt(bg.slice(5, 7), 16)) / 255 > 0.6 ? "#111827" : "#ffffff";

function icon(v: number, name: string, stat: ExtremeStat) {
  const bg = color(v, stat), w = stat === "gust" || stat === "rain" ? 74 : 58, h = 36;
  const label = `<div style="position:absolute;top:${h + 2}px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 10px/1.1 system-ui,sans-serif;color:#1f2937;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff;">${name}</div>`;
  const html = `<div style="background:${bg};color:${contrast(bg)};box-shadow:0 2px 6px rgba(0,0,0,0.22);border:2px solid white;border-radius:9999px;box-sizing:border-box;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:system-ui,sans-serif;padding:0 4px;white-space:nowrap;">${formatStationValue(v, stat)}</div>${label}`;
  return L.divIcon({ html, className: "weather-marker", iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

export function ExtremesMap({ stations, stat, generousPadding = false }: { stations: StationExtreme[]; stat: ExtremeStat; generousPadding?: boolean }) {
  return (
    <MapContainer bounds={BOUNDS} zoomSnap={0} zoomControl={false} attributionControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false}
      className="h-full w-full" style={{ background: "#eef2f5" }}>
      <Fit generousPadding={generousPadding} />
      <TileLayer url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png" maxZoom={18} />
      <GeoJSON data={lake as unknown as FeatureCollection} interactive={false} style={{ color: "#7fb3d9", weight: 1, fillColor: "#a9cfe9", fillOpacity: 0.9 }} />
      {stations.map((s) => {
        const value = s[stat];
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return <Marker key={s.id} title={s.name} alt={s.name} position={[s.lat, s.lon]} icon={icon(value, s.name, stat)} interactive={false} keyboard={false} />;
      })}
    </MapContainer>
  );
}
