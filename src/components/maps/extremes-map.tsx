import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExtremeStat, StationExtreme } from "@/lib/station-extremes";

const BOUNDS: L.LatLngBoundsExpression = [[47.477, 9.158], [47.641, 9.467]];

function Fit() {
  const map = useMap();
  useEffect(() => {
    const fit = () => { map.invalidateSize(); map.fitBounds(BOUNDS, { padding: [36, 36] }); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Farbe der Pille nach Temperatur (kalt = blau, warm = orange). */
const color = (t: number) => (t <= -5 ? "#1e3a8a" : t <= 0 ? "#2563eb" : t <= 5 ? "#0ea5e9" : t <= 15 ? "#f59e0b" : "#ea580c");

function icon(name: string, v: number, stat: ExtremeStat, extreme: boolean) {
  const arrow = stat === "min" ? "↓" : "↑";
  const html = `<div style="display:inline-flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);font-family:-apple-system,'SF Pro Text',system-ui,sans-serif;white-space:nowrap">
    <div style="background:${color(v)};color:#fff;border:${extreme ? "2px solid #fff" : "1px solid rgba(255,255,255,.6)"};box-shadow:0 2px 8px rgba(0,0,0,.25);border-radius:999px;padding:3px 10px;font-weight:700;font-size:${extreme ? 15 : 13}px">${arrow} ${v.toFixed(1)}°</div>
    <div style="margin-top:2px;font-size:10px;font-weight:600;color:#1f2937;text-shadow:0 0 3px #fff,0 0 3px #fff">${name}</div></div>`;
  return L.divIcon({ html, className: "", iconSize: [0, 0] });
}

export function ExtremesMap({ stations, stat }: { stations: StationExtreme[]; stat: ExtremeStat }) {
  return (
    <MapContainer bounds={BOUNDS} zoomControl={false} attributionControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false}
      className="h-full w-full" style={{ background: "#eef2f5" }}>
      <Fit />
      <TileLayer url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png" maxZoom={18} />
      {stations.map((s, i) => (
        <Marker key={s.id} position={[s.lat, s.lon]} icon={icon(s.name, s[stat]!, stat, i === 0)} interactive={false} />
      ))}
    </MapContainer>
  );
}
