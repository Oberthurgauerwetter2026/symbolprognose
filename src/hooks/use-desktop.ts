import { useEffect, useState } from 'react';

/** Wahr erst nach dem Laden im Browser und nur ab Desktop-Breite (Tailwind `lg`). */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}
