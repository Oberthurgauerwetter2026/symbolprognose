/**
 * Einheitlicher Ladeplatzhalter für alle Karten.
 * Sorgt dafür, dass Chunk- und Datenphase optisch identisch aussehen
 * und nicht wie zwei getrennte Ladevorgänge wirken.
 */

export function MapSkeleton({
  height = 620,
  regionHeight = false,
}: {
  height?: number;
  regionHeight?: boolean;
}) {
  return (
    <div
      className={
        regionHeight
          ? "relative h-[440px] w-full overflow-hidden rounded-lg bg-muted sm:h-[600px]"
          : "relative w-full overflow-hidden rounded-lg bg-muted"
      }
      style={regionHeight ? undefined : { height }}
      aria-busy="true"
      aria-label="Karte wird geladen"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />
    </div>
  );
}
