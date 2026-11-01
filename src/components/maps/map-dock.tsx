import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { cn } from "@/lib/utils";

/** Grabt die Leaflet-Map-Instanz aus dem MapContainer in den React-State. */
export function MapGrabber({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

/** Einheitlicher Dock-Button: aktiv = Marken-Blau, inaktiv = dezent. */
export function dockBtn(active: boolean) {
  return cn(
    "flex h-9 w-9 items-center justify-center transition-colors",
    active ? "bg-[#2561a1] text-white" : "hover:bg-neutral-100 hover:text-neutral-900",
  );
}
