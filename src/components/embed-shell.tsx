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

    // js-ok erst setzen, wenn der Live-Container tatsächlich Inhalt hat —
    // sonst würde der SSR-Fallback bereits verschwinden, bevor das Widget
    // gerendert ist (sichtbar als blauer Wrapper auf Display-Browsern).
    let cancelled = false;
    const html = document.documentElement;

    const tryActivate = (attempt = 0) => {
      if (cancelled) return;
      const h = ref.current?.getBoundingClientRect().height ?? 0;
      if (h > 40) {
        html.classList.add("js-ok");
        return;
      }
      if (attempt < 30) {
        // ~30 * 50ms = 1.5s
        setTimeout(() => tryActivate(attempt + 1), 50);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(() => tryActivate()));

    // Wenn ein dynamischer Chunk-Import fehlschlägt (typisch nach Re-Deploy
    // oder auf strikten Display-Browsern), den Fallback wieder einblenden.
    const isChunkError = (msg: string) =>
      /Importing a module script|Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk/i.test(
        msg,
      );

    const onError = (event: ErrorEvent) => {
      const msg = String(event?.message ?? event?.error ?? "");
      if (isChunkError(msg)) html.classList.remove("js-ok");
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg = String(
        (reason && (reason.message ?? reason)) ?? "",
      );
      if (isChunkError(msg)) html.classList.remove("js-ok");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      cancelled = true;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

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
