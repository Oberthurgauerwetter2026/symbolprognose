/**
 * Einheitlicher Ladeplatzhalter für alle Karten.
 * Sorgt dafür, dass Chunk- und Datenphase optisch identisch aussehen
 * und nicht wie zwei getrennte Ladevorgänge wirken.
 */

export function MapSkeleton({ height = 620 }: { height?: number }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-muted"
      style={{ height }}
      aria-busy="true"
      aria-label="Karte wird geladen"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />
    </div>
  );
}
