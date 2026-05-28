import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { LightningStrike } from "@/hooks/use-lightning";

/**
 * Zeichnet Blitz-Einschläge als Canvas-Punkte über die Karte. Frische
 * Treffer leuchten hell/gelb, ältere blassen über das Zeitfenster aus.
 * Eigene Canvas-Ebene (analog PrecipOverlay) für gute Performance bei
 * vielen Einschlägen.
 */
export function LightningLayer({
  strikes,
  windowMin = 60,
}: {
  strikes: LightningStrike[];
  windowMin?: number;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strikesRef = useRef<LightningStrike[]>(strikes);
  strikesRef.current = strikes;

  useEffect(() => {
    const redraw = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      cv.width = size.x * dpr;
      cv.height = size.y * dpr;
      cv.style.width = size.x + "px";
      cv.style.height = size.y + "px";
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(cv, topLeft);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.scale(dpr, dpr);

      const now = Date.now();
      const windowMs = windowMin * 60_000;
      for (const s of strikesRef.current) {
        const age = now - s.time;
        if (age < 0 || age > windowMs) continue;
        const pt = map.latLngToContainerPoint([s.lat, s.lon]);
        // Alters-Faktor 1 (frisch) → 0 (alt).
        const k = Math.max(0, 1 - age / windowMs);
        const alpha = 0.25 + 0.75 * k;
        const r = 2.5 + 2.5 * k;
        // Glow
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 214, 64, ${0.18 * k})`;
        ctx.fill();
        // Kern
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle =
          age < 5000
            ? `rgba(255, 255, 255, ${alpha})`
            : `rgba(255, 196, 0, ${alpha})`;
        ctx.fill();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = `rgba(180, 90, 0, ${alpha})`;
        ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const CanvasLayer = L.Layer.extend({
      onAdd(this: L.Layer & { _cv?: HTMLCanvasElement }) {
        const pane = map.getPanes().overlayPane;
        const cv = L.DomUtil.create("canvas", "lightning-canvas") as HTMLCanvasElement;
        cv.style.position = "absolute";
        cv.style.pointerEvents = "none";
        cv.style.zIndex = "460";
        pane.appendChild(cv);
        this._cv = cv;
        canvasRef.current = cv;
        map.on("moveend zoomend resize", redraw);
        redraw();
        return this;
      },
      onRemove(this: L.Layer & { _cv?: HTMLCanvasElement }) {
        if (this._cv) this._cv.remove();
        map.off("moveend zoomend resize", redraw);
        canvasRef.current = null;
        return this;
      },
    });

    const layer = new (CanvasLayer as unknown as new () => L.Layer)();
    layer.addTo(map);

    // Fade-Animation: regelmäßig neu zeichnen.
    const anim = setInterval(redraw, 1000);

    // Bei neuen Strikes sofort neu zeichnen.
    redrawTriggerRef.current = redraw;

    return () => {
      clearInterval(anim);
      redrawTriggerRef.current = null;
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, windowMin]);

  const redrawTriggerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    redrawTriggerRef.current?.();
  }, [strikes]);

  return null;
}
