/**
 * Gefahren-Symbole im Lucide-Stil (24x24, currentColor, strokeWidth 2).
 * Die Geometrie liegt in `hazard-svg.ts` – gemeinsame Quelle für Karte und
 * die PNG-Symbole der Push-Benachrichtigungen.
 */
import type { SVGProps } from "react";
import { HAZARD_SVG_INNER, SVG_ROOT_ATTRS } from "./hazard-svg";

function HazardSvg({
  hazard,
  className,
  ...rest
}: SVGProps<SVGSVGElement> & { hazard: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={SVG_ROOT_ATTRS.viewBox}
      fill={SVG_ROOT_ATTRS.fill}
      stroke={SVG_ROOT_ATTRS.stroke}
      strokeWidth={SVG_ROOT_ATTRS.strokeWidth}
      strokeLinecap={SVG_ROOT_ATTRS.strokeLinecap}
      strokeLinejoin={SVG_ROOT_ATTRS.strokeLinejoin}
      width="1em"
      height="1em"
      {...rest}
      className={className}
      dangerouslySetInnerHTML={{ __html: HAZARD_SVG_INNER[hazard] ?? "" }}
    />
  );
}

/** Einzelner Blitz – Gewitter. */
export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="gewitter" {...props} />;
}

/** Drei plastische Regentropfen. */
export function RainDropsIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="regen" {...props} />;
}

/** Drei Schneekristalle (eine grosse, zwei kleine). */
export function SnowflakesIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="schnee" {...props} />;
}

/** Windsack am Mast. */
export function WindsockIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="wind" {...props} />;
}

/** Strassenglätte – Verkehrszeichen «Schleudergefahr». */
export function SlipperyCarIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="glaette" {...props} />;
}

/** Frost – Thermometer mit Schneeflocke. */
export function FrostIcon(props: SVGProps<SVGSVGElement>) {
  return <HazardSvg hazard="frost" {...props} />;
}
