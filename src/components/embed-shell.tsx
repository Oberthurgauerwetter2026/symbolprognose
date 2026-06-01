import { useEffect, useRef, type ReactNode } from "react";

/**
 * Schlanke Hülle für /embed/*-Routen.
 * - Kein Sidebar/Header
 * - Standard: sendet die Höhe per postMessage an das einbettende Fenster
 * - `fillViewport`: füllt 100dvh (mit svh-Fallback für ältere iOS-Safaris),
 *   kein postMessage (iframe-Höhe wird vom Host gesetzt)
 */
export function EmbedShell({
  children,
  fillViewport = false,
}: {
  children: ReactNode;
  fillViewport?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fillViewport) return;
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
  }, [fillViewport]);

  if (fillViewport) {
    return (
      <div
        ref={ref}
        className="@container flex h-[100svh] min-h-[360px] w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="@container mx-auto min-h-[320px] w-full max-w-6xl p-0 @[360px]:p-2 @[520px]:p-4"
    >
      {children}
    </div>
  );
}
