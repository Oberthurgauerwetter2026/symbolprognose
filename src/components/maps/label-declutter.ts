/**
 * Überdeckungsprüfung für Karten-Labels.
 *
 * Labels werden in Web-Mercator-Weltpixeln projiziert (unabhängig davon,
 * wohin der Kartenausschnitt gerade verschoben ist), damit Namen beim
 * Schieben nicht ein- und ausschwingen. Wichtigste Labels zuerst: ein
 * kleinerer Ort weicht, wenn sein Name über einem schon gesetzten steht.
 */

export type DeclutterCandidate<T> = {
  item: T;
  lat: number;
  lon: number;
  /** Breite des Labels in CSS-Pixeln (inkl. Punkt bzw. Dreieck). */
  width: number;
  /** Kleinere Zahl = wichtiger und bleibt stehen. */
  priority: number;
  /**
   * Waagrechter Versatz des Labels gegenüber der Markierung in CSS-Pixeln.
   * Erlaubt es, einen Namen an einer eng stehenden Nachbarbeschriftung
   * vorbeizuschieben, ohne ihn geografisch zu versetzen.
   */
  anchorX?: number;
};

const TILE = 256;
/** Höhe einer Labelzeile in CSS-Pixeln. */
export const LABEL_HEIGHT = 15;
/** Versatz des Labels gegenüber der Markierung (transform: translate). */
const ANCHOR_X = -3;
const ANCHOR_Y = -7;

function worldPx(zoom: number): number {
  return TILE * Math.pow(2, zoom);
}

function xFor(lon: number, world: number): number {
  return ((lon + 180) / 360) * world;
}

function yFor(lat: number, world: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
}

/**
 * Hält Labels ohne Überlappung: es gewinnt jeweils die höhere Priorität.
 * Die Reihenfolge der Ausgabe entspricht der Eingabe.
 */
export function declutterLabels<T>(
  candidates: DeclutterCandidate<T>[],
  zoom: number,
  padding = 2,
): T[] {
  const world = worldPx(zoom);
  const order = candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.priority - b.c.priority || a.i - b.i);

  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const keep = new Set<number>();

  for (const { c, i } of order) {
    const x = xFor(c.lon, world);
    const y = yFor(c.lat, world);
    const anchorX = c.anchorX ?? ANCHOR_X;
    const box = {
      x0: x + anchorX - padding,
      x1: x + anchorX + c.width + padding,
      y0: y + ANCHOR_Y - padding,
      y1: y + ANCHOR_Y + LABEL_HEIGHT + padding,
    };

    const hits = boxes.some(
      (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
    );
    if (hits) continue;

    boxes.push(box);
    keep.add(i);
  }

  return candidates.filter((_, i) => keep.has(i)).map((c) => c.item);
}

/**
 * Raue Breite eines Textlabels in CSS-Pixeln. Bewusst leicht überschätzt,
 * damit Namen eher ausbleiben als sich zu berühren.
 */
export function textWidth(text: string, fontSize: number, ratio = 0.58): number {
  return text.length * fontSize * ratio;
}

/** Breite eines Stadtlabels: Punkt (16 px) plus Name. */
export function cityLabelWidth(name: string, tier: "large" | "medium" | "local"): number {
  const fontSize = tier === "large" ? 13 : tier === "medium" ? 12 : 11;
  return 16 + textWidth(name, fontSize);
}

/** Breite eines Gipfellabels: Dreieck plus Name plus Höhe. */
export function peakLabelWidth(name: string, elev: number): number {
  return 18 + textWidth(name, 11) + 3 + textWidth(String(elev), 10);
}
