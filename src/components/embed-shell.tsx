import { useEffect, useRef, type ReactNode } from "react";

/**
 * Schlanke Hülle für /embed/*-Routen.
 * - Kein Sidebar/Header
 * - Sendet die Höhe per postMessage an das einbettende Fenster
 */
export function EmbedShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const send = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      window.parent?.postMessage({ type: "lovable-weather:height", height: h }, "*");
    };

    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener("load", send);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", send);
    };
  }, []);

  return (
    <div ref={ref} className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
      {children}
    </div>
  );
}
