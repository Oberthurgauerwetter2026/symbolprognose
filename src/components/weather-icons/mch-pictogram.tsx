import { renderMchInnerSvg, mchLabel } from "./mch-spec";

/**
 * MeteoSwiss-Pictogramm pro MCH-Code (1–35 Tag / 101–135 Nacht).
 * Rendert genau das Symbol zur jeweiligen Code-Nummer — kein
 * heuristisches Mapping auf generische Wetter-Icons.
 */
export function MchPictogram({
  code,
  size = 48,
  className,
}: {
  code: number;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={mchLabel(code)}
      dangerouslySetInnerHTML={{ __html: renderMchInnerSvg(code) }}
    />
  );
}
