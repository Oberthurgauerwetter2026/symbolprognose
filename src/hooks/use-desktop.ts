import { useSyncExternalStore } from 'react';

const desktopQuery = '(min-width: 1024px)';
const getSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerSnapshot = () => false;
function subscribe(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** SSR-sicher, ab Tailwind `lg`; bei Rückkehr sofort aktuell, ohne einen verzögerten State-Effekt. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
