import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import lake from "@/data/lake.json";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExtremeStat, StationExtreme } from "@/lib/station-extremes";
import { formatStationValue } from "@/lib/station-extremes";
import { ForeignReliefLayers } from "./foreign-relief-layers";
import { CityMarkers } from "./city-markers";
import { LAKE, SWITZERLAND, THURGAU, OUTSIDE_MASK, OUTSIDE_CH_MASK, REGION_OUTLINE } from "./radar-base-geo";
import { stationColor as color, stationTextColor as contrast } from "@/lib/station-colors";

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

/** Umriss, Aussenmasken und See wie die Live-Karte im Weather Hub und die Radarkarte. */
function RegionLayers() {
  return <>
    <GeoJSON data={OUTSIDE_CH_MASK} style={() => ({ stroke: false, fillColor: "#3a4148", fillOpacity: 0.3 })} interactive={false} />
    <GeoJSON data={OUTSIDE_MASK} style={() => ({ stroke: false, fillColor: "#5a6670", fillOpacity: 0.18 })} interactive={false} />
    <GeoJSON data={SWITZERLAND} style={() => ({ color: "#ffffff", weight: 1.2, opacity: 0.95, fill: false })} interactive={false} />
    <GeoJSON data={THURGAU} style={() => ({ color: "#1f4d80", weight: 1, opacity: 0.45, fill: false })} interactive={false} />
    <GeoJSON data={LAKE} style={() => ({ color: "#5ba8c8", weight: 1.2, fillColor: "#d7e9ee", fillOpacity: 1 })} interactive={false} />
    <GeoJSON data={REGION_OUTLINE} style={() => ({ color: "#1f4d80", weight: 2, opacity: 0.9, fill: false })} interactive={false} />
  </>;
}

/** Pille ohne Namenszeile; beim aktuellen Wind mit Pfeil in Wehrichtung (Herkunft + 180°). */
function regionIcon(v: number, stat: ExtremeStat, dir: number | null) {
  const bg = color(v, stat), fg = contrast(bg), h = 36, w = stat === "wind" ? 88 : stat === "rainRate" ? 82 : stat === "gust" || stat === "rain" ? 74 : 58;
  const arrow = stat === "wind" && dir !== null
    ? `<svg width="13" height="13" viewBox="0 0 24 24" style="transform:rotate(${dir + 180}deg);margin-right:4px;flex-shrink:0;" aria-hidden="true"><path d="M12 2 L17 12 L13 12 L13 22 L11 22 L11 12 L7 12 Z" fill="${fg}"/></svg>` : "";
  const html = `<div style="background:${bg};color:${fg};box-shadow:0 2px 6px rgba(0,0,0,0.22);border:2px solid white;border-radius:9999px;box-sizing:border-box;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:system-ui,sans-serif;padding:0 4px;white-space:nowrap;">${arrow}${formatStationValue(v, stat)}</div>`;
  return L.divIcon({ html, className: "weather-marker", iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

function icon(v: number, name: string, stat: ExtremeStat) {
  const bg = color(v, stat), w = stat === "gust" || stat === "rain" ? 74 : 58, h = 36;
  const label = `<div style="position:absolute;top:${h + 2}px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 10px/1.1 system-ui,sans-serif;color:#1f2937;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff;">${name}</div>`;
  const html = `<div style="background:${bg};color:${contrast(bg)};box-shadow:0 2px 6px rgba(0,0,0,0.22);border:2px solid white;border-radius:9999px;box-sizing:border-box;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-family:system-ui,sans-serif;padding:0 4px;white-space:nowrap;">${formatStationValue(v, stat)}</div>${label}`;
  return L.divIcon({ html, className: "weather-marker", iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

type Hover = { id: string; x: number; y: number; w: number };
const CARD_W = 168, CARD_H = 46;

/** Infofenster der Station: nur Ort und Quelle, die Messwerte stehen in den Reitern. Liegt über der Karte, damit es nie abgeschnitten wird. */
function StationCard({ station, at }: { station: StationExtreme; at: Hover }) {
  const left = Math.max(6, Math.min(at.w - CARD_W - 6, at.x - CARD_W / 2));
  const above = at.y - 24 - CARD_H >= 4;
  return (
    <div role="status" data-station-card className="pointer-events-none absolute z-[700] overflow-hidden rounded-md bg-white leading-tight text-neutral-900 shadow-lg ring-1 ring-black/10"
      style={{ left, top: above ? at.y - 24 - CARD_H : at.y + 24, width: CARD_W }}>
      <div className="truncate px-2 pt-1.5 text-xs font-semibold">{station.name}</div>
      <div className="truncate px-2 pb-1.5 pt-0.5 text-[10px] text-neutral-500">Quelle: {station.source === "meteoswiss" ? "MeteoSchweiz" : "Oberthurgauer Wetter"}</div>
    </div>
  );
}

/** Tippen neben eine Station schliesst das Infofenster. */
function CloseOnMapClick({ onClose }: { onClose: () => void }) {
  const map = useMap();
  useEffect(() => { map.on("click", onClose); return () => { map.off("click", onClose); }; }, [map, onClose]);
  return null;
}

/** regionStyle: Kartenbild der Live-Karte (Umriss, Masken, Ortsnamen); ohne die Option bleibt die Einbettung unverändert. */
export function ExtremesMap({ stations, stat, generousPadding = false, regionStyle = false }: { stations: StationExtreme[]; stat: ExtremeStat; generousPadding?: boolean; regionStyle?: boolean }) {
  // Symbole nur bei neuen Werten neu bauen: ein neues Element unter dem Mauszeiger würde das Wegfahren verschlucken.
  const icons = useMemo(() => new Map(stations.map((s) => {
    const value = s[stat];
    return [s.id, typeof value === "number" && Number.isFinite(value) ? (regionStyle ? regionIcon(value, stat, s.windDir ?? null) : icon(value, s.name, stat)) : null] as const;
  })), [stations, stat, regionStyle]);
  const [hover, setHover] = useState<Hover | null>(null);
  const hovered = hover ? stations.find((s) => s.id === hover.id) : undefined;
  const show = (s: StationExtreme, marker: L.Marker) => {
    const map = (marker as L.Marker & { _map?: L.Map })._map;
    if (!map) return;
    const point = map.latLngToContainerPoint(marker.getLatLng());
    setHover({ id: s.id, x: point.x, y: point.y, w: map.getSize().x });
  };
  return (
    <div className="relative h-full w-full">
    <MapContainer bounds={BOUNDS} zoomSnap={0} zoomControl={false} attributionControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false}
      className="h-full w-full" style={{ background: regionStyle ? "#ebefeb" : "#eef2f5" }}>
      <Fit generousPadding={generousPadding} />
      {regionStyle && <CloseOnMapClick onClose={() => setHover(null)} />}
      {regionStyle && <ForeignReliefLayers />}
      <TileLayer url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png" maxZoom={18} opacity={regionStyle ? 0.9 : 1} />
      {regionStyle ? <><RegionLayers /><CityMarkers /></> : <GeoJSON data={lake as unknown as FeatureCollection} interactive={false} style={{ color: "#7fb3d9", weight: 1, fillColor: "#a9cfe9", fillOpacity: 0.9 }} />}
      {stations.map((s) => {
        const value = s[stat];
        const markerIcon = icons.get(s.id);
        if (typeof value !== "number" || !Number.isFinite(value) || !markerIcon) return null;
        return <Marker key={s.id} {...(regionStyle ? {} : { title: s.name })} alt={s.name} position={[s.lat, s.lon]} icon={markerIcon} zIndexOffset={1000} interactive={regionStyle} keyboard={false}
          {...(regionStyle ? { eventHandlers: { mouseover: (e: L.LeafletMouseEvent) => show(s, e.target as L.Marker), mouseout: () => setHover(null), click: (e: L.LeafletMouseEvent) => show(s, e.target as L.Marker) } } : {})} />;
      })}
    </MapContainer>
    {hover && hovered && <StationCard station={hovered} at={hover} />}
    </div>
  );
}
