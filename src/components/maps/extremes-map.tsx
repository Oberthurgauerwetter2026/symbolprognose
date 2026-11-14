import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExtremeStat, StationExtreme } from "@/lib/station-extremes";

const BOUNDS: L.LatLngBoundsExpression = [[47.477, 9.158], [47.641, 9.467]];

function Fit() {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      const small = map.getSize().x <= 480;
      map.fitBounds(BOUNDS, {
        paddingTopLeft: small ? [20, 35] : [36, 36],
        paddingBottomRight: small ? [20, 0] : [36, 36],
        animate: false,
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Gleiche Farbskala und Pillen wie die Live-Karte im Weather Hub.
const STOPS: [number, string][] = [[-30,"#0f1020"],[-27,"#13172f"],[-24,"#181e3f"],[-21,"#1c254e"],[-18,"#212c5e"],[-15,"#25336d"],[-12,"#2a3a7d"],[-9,"#2e418c"],[-6,"#33489c"],[-3,"#3a55b5"],[0,"#4169c9"],[3,"#3690d0"],[6,"#2f9dd0"],[9,"#3fbec2"],[12,"#44c47e"],[15,"#80ce62"],[18,"#bcd84a"],[21,"#f0dc3a"],[24,"#efc551"],[27,"#ed9a28"],[30,"#ea7826"],[33,"#e35a2a"],[36,"#d83a33"],[39,"#b82c2a"],[42,"#8e2020"]];
const h2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
function color(v: number): string {
  if (v <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [av, ac] = STOPS[i], [bv, bc] = STOPS[i + 1];
    if (v <= bv) {
      const t = (v - av) / (bv - av), c = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
      return "#" + [1, 3, 5].map((o) => h2(c(ac, o) + (c(bc, o) - c(ac, o)) * t)).join("");
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const contrast = (bg: string) => (0.299 * parseInt(bg.slice(1, 3), 16) + 0.587 * parseInt(bg.slice(3, 5), 16) + 0.114 * parseInt(bg.slice(5, 7), 16)) / 255 > 0.6 ? "#111827" : "#ffffff";

function icon(v: number) {
  const bg = color(v), w = 58, h = 36;
  const html = `<div style="background:${bg};color:${contrast(bg)};box-shadow:0 2px 6px rgba(0,0,0,0.22);border:2px solid white;border-radius:9999px;min-width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:system-ui,sans-serif;padding:0 8px;white-space:nowrap;">${v.toFixed(1)}°</div>`;
  return L.divIcon({ html, className: "weather-marker", iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

export function ExtremesMap({ stations, stat }: { stations: StationExtreme[]; stat: ExtremeStat }) {
  return (
    <MapContainer bounds={BOUNDS} zoomSnap={0} zoomControl={false} attributionControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false}
      className="h-full w-full" style={{ background: "#eef2f5" }}>
      <Fit />
      <TileLayer url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png" maxZoom={18} />
      {stations.map((s) => {
        const value = s[stat];
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return <Marker key={s.id} title={s.name} alt={s.name} position={[s.lat, s.lon]} icon={icon(value)} interactive={false} keyboard={false} />;
      })}
    </MapContainer>
  );
}
