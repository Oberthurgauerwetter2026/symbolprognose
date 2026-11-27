import { useEffect, useRef, useState } from 'react';

/**
 * Echtzeit-Vorschau als eingebettete Originalkarte (reine Kartenansicht `clean=1`) ohne
 * Bedienung. Nur noch für Kacheln ohne leichtes Standbild (siehe tile-previews.tsx) und
 * nur auf dem Desktop; sie lädt erst nahe am Bildausschnitt und bleibt danach stehen.
 */
const MIN_MAP_WIDTH = 380;
/** Die Quellenzeile der Einbettung liegt ausserhalb der Kachel; sie steht auf der Detailseite. */
const CREDIT_CROP = 44;

export function LivePreview({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Schmale Kacheln zeigen die Karte verkleinert, damit der Ausschnitt lesbar bleibt.
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      // Einmal geladen bleibt die Karte stehen – kein Verschwinden beim Scrollen.
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '300px 0px' });
    observer.observe(el);
    const resize = new ResizeObserver(() => setZoom(Math.min(1, el.clientWidth / MIN_MAP_WIDTH) || 1));
    resize.observe(el);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, []);
  return <div ref={ref} className="absolute inset-0 overflow-hidden bg-muted" data-live-preview>
    {near && <iframe src={src} title={title} tabIndex={-1} aria-hidden="true" onLoad={() => setLoaded(true)}
      style={{ width: `${100 / zoom}%`, height: `calc(${100 / zoom}% + ${CREDIT_CROP}px)`, transform: `scale(${zoom})` }}
      className={`pointer-events-none block max-w-none origin-top-left border-0 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
  </div>;
}
