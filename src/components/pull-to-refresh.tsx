import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { isPullGesture, pullDistance, shouldRefresh, PULL_TRIGGER } from '@/lib/pull-refresh';

/**
 * Herunterziehen am Seitenanfang lädt die Daten neu. Nur in der installierten
 * Web-App: im Browser erledigt das die eingebaute Geste, sonst gäbe es zwei.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    let start: { x: number; y: number } | null = null;
    let active = false, distance = 0, running = false;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      active = false; distance = 0;
      start = !running && touch && event.touches.length === 1 && window.scrollY <= 0 ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (!active) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (!isPullGesture(dx, dy)) { start = null; return; }
        active = true;
      }
      distance = pullDistance(dy);
      setPull(distance);
      if (event.cancelable) event.preventDefault();
    };
    const onEnd = () => {
      if (!active) { start = null; return; }
      start = null; active = false;
      if (!shouldRefresh(distance)) { setPull(0); return; }
      running = true; setBusy(true); setPull(PULL_TRIGGER);
      const minimum = new Promise(resolve => window.setTimeout(resolve, 600));
      void Promise.allSettled([refresh.current(), minimum]).then(() => { running = false; setBusy(false); setPull(0); });
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  const shown = busy || pull > 0;
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[700] flex justify-center" style={{ transform: `translateY(${pull - 48}px)`, opacity: shown ? Math.min(1, pull / 32) : 0, transition: pull === 0 || busy ? 'transform 200ms ease, opacity 200ms ease' : 'none' }}>
    <span className="weather-dark grid size-10 place-items-center rounded-full border border-border bg-card">
      <RefreshCw className={`size-5${busy ? ' animate-spin' : ''}`} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
    </span>
    {busy && <span className="sr-only">Wird aktualisiert …</span>}
  </div>;
}
