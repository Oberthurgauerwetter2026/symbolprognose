/**
 * Rückkehr an die Stelle der Übersicht, an der eine Kachel geöffnet wurde.
 * Gemerkt wird die angetippte Verknüpfung samt ihrer Höhe im Fenster; so stimmt
 * die Stelle auch dann, wenn darüber noch Inhalte nachladen und die Seite wächst.
 * Zurückgesprungen wird nur nach ausdrücklichem Schliessen (X) – ein App-Start
 * oder die Rückkehr aus dem Hintergrund zeigt die Übersicht von oben.
 */
export interface HomeAnchor {
  /** Pfad der angetippten Verknüpfung; leer, wenn kein Link getroffen wurde. */
  path: string;
  /** Position unter den sichtbaren Verknüpfungen mit demselben Pfad. */
  index: number;
  /** Abstand der Verknüpfung zum oberen Fensterrand beim Antippen. */
  top: number;
  /** Rollposition der Seite beim Antippen (Rückfall, wenn der Link fehlt). */
  scrollY: number;
}

let anchor: HomeAnchor | null = null;
let closing = false;
let returnTransition: Promise<void> | null = null;
let returnReveal: Promise<void> | null = null;

/** Längste Wartezeit, bis die Regionskarte nach dem Schliessen aufgebaut wird. */
export const HOME_REVEAL_LIMIT_MS = 250;

/** Desktop-Rückweg: keine grosse Kartenaufnahme in eine Miniatur skalieren. */
export function startDesktopHomeReturn(update: () => Promise<void>): void {
  markHomeReturn();
  if (typeof document.startViewTransition !== 'function') { returnTransition = null; returnReveal = null; void update(); return; }
  document.documentElement.classList.add('desktop-home-return');
  const transition = document.startViewTransition(update);
  const settled = transition.finished.catch(() => undefined);
  returnTransition = settled.finally(() => {
    document.documentElement.classList.remove('desktop-home-return');
    returnTransition = null;
  });
  // Die Karte wartet nur, bis die Übersicht aufgenommen ist (ready), nicht bis zum Ende des
  // Überblendens – und nie länger als die Obergrenze, falls der Browser das Signal verschluckt.
  const captured = Promise.resolve(transition.ready).catch(() => undefined);
  const limit = new Promise<void>(resolve => { setTimeout(resolve, HOME_REVEAL_LIMIT_MS); });
  const reveal: Promise<void> = Promise.race([captured, settled, limit]).then(() => { if (returnReveal === reveal) returnReveal = null; });
  returnReveal = reveal;
}

export const getHomeReturnTransition = (): Promise<void> | null => returnTransition;
/** Offen, solange die Regionskarte nach dem Schliessen noch nicht aufgebaut werden soll. */
export const getHomeReturnReveal = (): Promise<void> | null => returnReveal;

export function rememberHomeAnchor(next: HomeAnchor): void { anchor = next; closing = false; }
export const hasHomeAnchor = (): boolean => anchor !== null;
/** Der Nutzer schliesst die Detailseite mit dem X. */
export function markHomeReturn(): void { closing = anchor !== null; }
/** Liefert die gemerkte Stelle genau einmal und nur nach einem Schliessen. */
export function takeHomeReturn(): HomeAnchor | null {
  const result = closing ? anchor : null;
  anchor = null; closing = false;
  return result;
}

function visibleLinks(root: HTMLElement, path: string): HTMLAnchorElement[] {
  if (!path) return [];
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => a.getClientRects().length > 0 && a.origin === window.location.origin && a.pathname === path);
}

/** Beschreibt die Stelle eines Klicks innerhalb der Übersicht. */
export function describeHomeClick(root: HTMLElement, target: EventTarget | null): HomeAnchor {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  const fallback: HomeAnchor = { path: '', index: 0, top: 0, scrollY: window.scrollY };
  if (!link || link.origin !== window.location.origin) return fallback;
  const index = visibleLinks(root, link.pathname).indexOf(link);
  if (index < 0) return fallback;
  return { path: link.pathname, index, top: link.getBoundingClientRect().top, scrollY: window.scrollY };
}

/**
 * Stellt die gemerkte Stelle her und hält sie kurz nach, solange die Seite noch
 * wächst; die erste Eingabe des Nutzers beendet das Nachführen sofort.
 */
export function restoreHomePosition(root: HTMLElement, target: HomeAnchor, done: () => void): () => void {
  const apply = () => {
    const links = visibleLinks(root, target.path);
    const link = links[target.index] ?? links[0];
    if (link) window.scrollBy({ top: link.getBoundingClientRect().top - target.top, behavior: 'instant' });
    else window.scrollTo({ top: target.scrollY, behavior: 'instant' });
  };
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const observer = new ResizeObserver(apply);
  let released = false;
  const release = () => {
    released = true;
    observer.disconnect();
    window.clearTimeout(timer);
    for (const name of events) window.removeEventListener(name, finish);
  };
  const finish = () => { release(); done(); };
  const timer = window.setTimeout(finish, 3000);
  for (const name of events) window.addEventListener(name, finish, { passive: true });
  apply();
  // Zielposition vor der Aufnahme setzen; spätere Layoutkorrekturen erst danach.
  const observe = () => { if (!released) { apply(); observer.observe(root); } };
  if (returnTransition) void returnTransition.then(observe);
  else observer.observe(root);
  return release;
}
