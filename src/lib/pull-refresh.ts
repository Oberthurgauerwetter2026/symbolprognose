/** Aktualisieren durch Herunterziehen: reine Rechenregeln (getestet). */
export const PULL_TRIGGER = 64;
export const PULL_MAX = 96;

/** Gedämpfter Weg der Anzeige; aufwärts gezogen bleibt sie stehen. */
export function pullDistance(dy: number): number {
  return dy <= 0 ? 0 : Math.min(PULL_MAX, dy * 0.5);
}

/** Erst ein deutlicher Zug löst aus, ein kurzes Antippen oder Wischen nie. */
export const shouldRefresh = (distance: number): boolean => distance >= PULL_TRIGGER;

/** Nur ein überwiegend senkrechter Zug nach unten zählt; seitliches Wischen (Stundenstreifen) nicht. */
export function isPullGesture(dx: number, dy: number): boolean {
  return dy > 0 && dy > Math.abs(dx);
}
