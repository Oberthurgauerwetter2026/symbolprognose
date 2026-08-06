import L from "leaflet";

/**
 * Canvas-Overlays (Radar, Wind) zeichnen ihr Bild erst nach `zoomend` neu.
 * Damit sie während des Zoomens nicht "hinterherhängen", wird das bestehende
 * Bild durchgehend per CSS-Transform (Translate + Scale) synchron mit den
 * Kartenkacheln mitgezogen — auch bei Wheel-Zoom-Schritten ohne saubere
 * `zoomanim`-Animation.
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

  // Zoomstand/Position beim Start des Zooms — Referenz für die Transform.
  let startZoom = map.getZoom();
  let startTopLeftLatLng = map.containerPointToLatLng([0, 0]);

  const capture = () => {
    startZoom = map.getZoom();
    startTopLeftLatLng = map.containerPointToLatLng([0, 0]);
  };

  const applyTransform = (zoom: number, center: L.LatLng) => {
    const scale = map.getZoomScale(zoom, startZoom);
    const offset = internals._latLngToNewLayerPoint(startTopLeftLatLng, zoom, center);
    L.DomUtil.setTransform(canvas, offset, scale);
  };

  const onZoomStart = () => {
    capture();
  };

  // Leaflet-Zoom-Animation: Ziel-Zoom/-Center kommen im Event.
  const onZoomAnim = (e: L.ZoomAnimEvent) => {
    applyTransform(e.zoom, e.center);
  };

  // Zoom ohne Animation (z. B. Wheel-Zoom-Schritte, zoomAnimation aus):
  // laufend mitskalieren, damit kein Standbild entsteht.
  const onZoom = () => {
    if (internals._animatingZoom) return;
    applyTransform(map.getZoom(), map.getCenter());
  };

  // Nach dem Zoom exakt neu zeichnen (setzt die Transform zurück).
  const onZoomEnd = () => {
    redraw();
  };

  map.on("zoomstart", onZoomStart);
  map.on("zoomanim", onZoomAnim);
  map.on("zoom", onZoom);
  map.on("zoomend", onZoomEnd);

  const detach: Detach = () => {
    map.off("zoomstart", onZoomStart);
    map.off("zoomanim", onZoomAnim);
    map.off("zoom", onZoom);
    map.off("zoomend", onZoomEnd);
    registry.delete(canvas);
  };
  registry.set(canvas, detach);
  return detach;
}

export function detachCanvasZoomAnim(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return;
  registry.get(canvas)?.();
}
