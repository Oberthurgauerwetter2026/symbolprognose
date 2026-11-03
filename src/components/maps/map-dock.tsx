import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

/** Grabt die Leaflet-Map-Instanz aus dem MapContainer in den React-State. */
export function MapGrabber({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

/** Einheitlicher Dock-Button: aktiv = Marken-Blau, inaktiv = dezent. */
export function dockBtn(active: boolean) {
  return cn(
    "flex h-8 w-8 items-center justify-center transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.75]",
    active ? "text-[#2561a1] bg-[#2561a1]/10" : "text-neutral-500 hover:bg-black/5 hover:text-neutral-900",
  );
}

/** Gemeinsamer, dezenter Dock-Rahmen. */
export const DOCK_CLASS =
  "absolute right-3 top-3 z-[450] flex flex-col overflow-hidden rounded-lg bg-white/75 shadow-sm ring-1 ring-black/[0.06] backdrop-blur-md divide-y divide-black/[0.06]";

/** Zoom-Dock im Radar-Stil; innerhalb eines MapContainer rendern. */
export function DockZoomControl() {
  const map = useMap();
  return (
    <div
      className={DOCK_CLASS}
      ref={(el) => { if (el) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el); } }}
    >
      <button type="button" aria-label="Hineinzoomen" title="Hineinzoomen" onClick={() => map.zoomIn()} className={dockBtn(false)}>
        <Plus />
      </button>
      <button type="button" aria-label="Herauszoomen" title="Herauszoomen" onClick={() => map.zoomOut()} className={dockBtn(false)}>
        <Minus />
      </button>
    </div>
  );
}
