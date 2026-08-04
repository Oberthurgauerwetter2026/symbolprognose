import L from "leaflet";

/**
 * Canvas-Overlays (Radar, Wind) zeichnen ihr Bild erst nach `zoomend` neu.
 * Damit sie während der Zoom-Animation nicht "hinterherhängen", wird das
 * bestehende Bild per CSS-Transform (Translate + Scale) synchron mit den
 * Kartenkacheln mitgezogen — genau wie Leaflet es für eigene Renderer macht.
 *
 * Nach `zoomend` setzt der reguläre Redraw-Pfad (`L.DomUtil.setPosition`) die
 * Transform wieder auf reines Translate zurück und zeichnet exakt neu.
 */

type Detach = () => void;

const registry = new WeakMap<HTMLCanvasElement, Detach>();

interface MapInternals {
  _latLngToNewLayerPoint: (latlng: L.LatLng, zoom: number, center: L.LatLng) => L.Point;
  _animatingZoom?: boolean;
}

export function attachCanvasZoomAnim(
  map: L.Map,
  canvas: HTMLCanvasElement,
  redraw: () => void,
): Detach {
  const internals = map as unknown as MapInternals;

  const onZoomAnim = (e: L.ZoomAnimEvent) => {
    const scale = map.getZoomScale(e.zoom, map.getZoom());
    const topLeft = map.containerPointToLatLng([0, 0]);
    const offset = internals._latLngToNewLayerPoint(topLeft, e.zoom, e.center);
    L.DomUtil.setTransform(canvas, offset, scale);
  };

  // Fällt die Zoom-Animation aus (z. B. zoomAnimation deaktiviert), sorgt der
  // direkte Redraw dafür, dass kein Versatz stehen bleibt.
  const onZoom = () => {
    if (internals._animatingZoom) return;
    redraw();
  };

  map.on("zoomanim", onZoomAnim);
  map.on("zoom", onZoom);

  const detach: Detach = () => {
    map.off("zoomanim", onZoomAnim);
    map.off("zoom", onZoom);
    registry.delete(canvas);
  };
  registry.set(canvas, detach);
  return detach;
}

export function detachCanvasZoomAnim(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return;
  registry.get(canvas)?.();
}
