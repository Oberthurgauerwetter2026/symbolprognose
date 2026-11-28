import { useEffect, useId } from "react";
import { useMap } from "react-leaflet";

/** Align the SVG tint to the page, not the geographic polygon or map viewport. */
export function RadarPageGradient() {
  const map = useMap();
  const id = `radar-page-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const container = map.getContainer();
    const main = container.closest<HTMLElement>(".weather-main.weather-detail");
    if (!main) return;
    const ns = "http://www.w3.org/2000/svg";
    let frame = 0;
    const gradients = new Map<SVGSVGElement, SVGLinearGradientElement>();
    const update = () => {
      const bounds = main.getBoundingClientRect();
      for (const path of container.querySelectorAll<SVGPathElement>(".radar-outside-ch, .radar-ch-outline")) {
        const svg = path.ownerSVGElement;
        const matrix = svg?.getScreenCTM();
        if (!svg || !matrix) continue;
        let gradient = gradients.get(svg);
        if (!gradient) {
          const defs = document.createElementNS(ns, "defs");
          gradient = document.createElementNS(ns, "linearGradient");
          gradient.id = `${id}-${gradients.size}`;
          gradient.setAttribute("gradientUnits", "userSpaceOnUse");
          const top = document.createElementNS(ns, "stop");
          top.setAttribute("offset", "0");
          top.classList.add("radar-page-gradient-top");
          const bottom = document.createElementNS(ns, "stop");
          bottom.setAttribute("offset", "1");
          bottom.classList.add("radar-page-gradient-bottom");
          gradient.append(top, bottom);
          defs.append(gradient);
          svg.prepend(defs);
          gradients.set(svg, gradient);
        }
        const inverse = matrix.inverse();
        const top = new DOMPoint(bounds.left, bounds.top).matrixTransform(inverse);
        const bottom = new DOMPoint(bounds.left, bounds.bottom).matrixTransform(inverse);
        gradient.setAttribute("x1", String(top.x));
        gradient.setAttribute("y1", String(top.y));
        gradient.setAttribute("x2", String(bottom.x));
        gradient.setAttribute("y2", String(bottom.y));
        path.style.setProperty("--radar-page-gradient", `url(#${gradient.id})`);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(main);
    resize.observe(container);
    const mutations = new MutationObserver(schedule);
    mutations.observe(container, { childList: true, subtree: true });
    map.on("move zoomend resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      map.off("move zoomend resize", schedule);
      window.removeEventListener("scroll", schedule);
      for (const path of container.querySelectorAll<SVGPathElement>(".radar-outside-ch, .radar-ch-outline")) {
        path.style.removeProperty("--radar-page-gradient");
      }
      for (const gradient of gradients.values()) gradient.parentElement?.remove();
    };
  }, [map, id]);

  return null;
}