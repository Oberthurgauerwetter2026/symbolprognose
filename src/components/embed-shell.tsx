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
  flush = false,
}: {
  children: ReactNode;
  fillViewport?: boolean;
  flush?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // js-ok erst setzen, wenn der Live-Container tatsächlich Inhalt hat —
    // sonst würde der SSR-Fallback bereits verschwinden, bevor das Widget
    // gerendert ist (sichtbar als blauer Wrapper auf Display-Browsern).
    let cancelled = false;
    const html = document.documentElement;
    html.classList.add("embed");

    const tryActivate = (attempt = 0) => {
      if (cancelled) return;
      const el = ref.current;
      const h = el?.getBoundingClientRect().height ?? 0;
      // Solange .js-ok fehlt, ist .embed-live per CSS ausgeblendet — dann ist
      // die gemessene Höhe immer 0. In diesem Fall genügt es zu prüfen, dass
      // React tatsächlich Inhalt in den Live-Container gerendert hat.
      const hiddenButRendered =
        !!el && el.offsetParent === null && el.childElementCount > 0;
      if (h > 40 || hiddenButRendered) {
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
      html.classList.remove("embed");
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fillViewport) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const measure = () =>
      Math.ceil(
        // Nur den eigenen Inhalt messen. documentElement.scrollHeight enthält
        // die iframe-Viewporthöhe und würde verhindern, dass das iframe je
        // wieder schrumpft (typisch auf Mobile: unnötig lange Seite).
        Math.max(el.getBoundingClientRect().height, el.scrollHeight),
      );

    const send = () => {
      const h = measure();
      // Kurzzeitige Einbrüche (Neu-Mount, Chunk-Load) nicht melden.
      if (h < 80) return;
      window.parent?.postMessage({ type: "lovable-weather:height", height: h }, "*");
    };


    const scheduleSend = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        send();
      });
    };

    scheduleSend();
    // Nachmeldungen, sobald Karte/Bilder fertig sind
    timers = [600, 1500, 3000].map((ms) => setTimeout(send, ms));

    const ro = new ResizeObserver(scheduleSend);
    ro.observe(el);
    window.addEventListener("load", send);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
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
      className={
        flush
          ? "@container mx-auto w-full max-w-6xl p-0"
          : "@container mx-auto min-h-[320px] w-full max-w-6xl p-0 @[360px]:p-2 @[520px]:p-4"
      }
    >
      {children}
    </div>
  );
}
