import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { LatLon } from "@/lib/snowcast";

const icon = L.divIcon({ className: "", html: '<div style="width:14px;height:14px;border-radius:9999px;background:#2561a1;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

function Clicks({ onAdd }: { onAdd: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onAdd({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}
function Fit({ points, fitKey }: { points: LatLon[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => { if (points.length >= 2) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [24, 24] }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

export function SnowcastRouteMap({ points, samples, fitKey, onChange, editable }: {
  points: LatLon[]; samples: LatLon[]; fitKey: string; editable: boolean; onChange: (p: LatLon[]) => void;
}) {
  return (
    <MapContainer center={[47.55, 9.2]} zoom={10} className="h-full w-full" scrollWheelZoom attributionControl={false}>
      <TileLayer url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg" maxZoom={17} />
      <Fit points={points} fitKey={fitKey} />
      {editable && <Clicks onAdd={(p) => onChange([...points, p])} />}
      <Polyline positions={points.map((p) => [p.lat, p.lon] as [number, number])} pathOptions={{ color: "#2561a1", weight: 4 }} />
      {samples.map((s, i) => <CircleMarker key={i} center={[s.lat, s.lon]} radius={2} pathOptions={{ color: "#0f172a", weight: 1 }} />)}
      {points.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lon]} icon={icon} draggable={editable}
          eventHandlers={{
            dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onChange(points.map((q, j) => (j === i ? { ...q, lat: ll.lat, lon: ll.lng } : q))); },
            contextmenu: () => { if (editable && points.length > 2) onChange(points.filter((_, j) => j !== i)); },
            dblclick: () => { if (editable && points.length > 2) onChange(points.filter((_, j) => j !== i)); },
          }} />
      ))}
    </MapContainer>
  );
}
export default SnowcastRouteMap;
