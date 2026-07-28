/**
 * Eigene Gefahren-Symbole im Lucide-Stil (24x24, currentColor, strokeWidth 2).
 */
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Einzelner Blitz – Gewitter. */
export function BoltIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <path d="M13.5 2 5 13.5h5.5L9.5 22 19 10.2h-6l.5-8.2z" />
    </svg>
  );
}

/** Drei Regentropfen. */
export function RainDropsIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <path d="M6.5 3.5c1.9 2.4 2.9 4.1 2.9 5.3a2.9 2.9 0 1 1-5.8 0c0-1.2 1-2.9 2.9-5.3z" />
      <path d="M17.5 3.5c1.9 2.4 2.9 4.1 2.9 5.3a2.9 2.9 0 1 1-5.8 0c0-1.2 1-2.9 2.9-5.3z" />
      <path d="M12 12.5c1.9 2.4 2.9 4.1 2.9 5.3a2.9 2.9 0 1 1-5.8 0c0-1.2 1-2.9 2.9-5.3z" />
    </svg>
  );
}

/** Drei Schneeflocken (eine grosse, zwei kleine). */
export function SnowflakesIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      {/* grosse Flocke */}
      <g transform="translate(8.2 8.2) scale(0.62) translate(-12 -12)">
        <path d="M12 2v20" />
        <path d="M3.5 7l17 10" />
        <path d="M20.5 7l-17 10" />
        <path d="M9 4.2 12 6.6l3-2.4" />
        <path d="M9 19.8 12 17.4l3 2.4" />
      </g>
      {/* kleine Flocke rechts */}
      <g transform="translate(18 8) scale(0.3) translate(-12 -12)">
        <path d="M12 2v20" />
        <path d="M3.5 7l17 10" />
        <path d="M20.5 7l-17 10" />
      </g>
      {/* kleine Flocke unten */}
      <g transform="translate(14 18.2) scale(0.34) translate(-12 -12)">
        <path d="M12 2v20" />
        <path d="M3.5 7l17 10" />
        <path d="M20.5 7l-17 10" />
      </g>
    </svg>
  );
}

/** Windsack am Mast – identisch zur Lokalprognose. */
export function WindsockIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <line x1="4" y1="3" x2="4" y2="21" />
      <path d="M4 6 L20 8 L17 13 L4 14 Z" />
      <line x1="9" y1="6.6" x2="9" y2="13.7" />
      <line x1="14" y1="7.3" x2="14" y2="13.4" />
    </svg>
  );
}

/** Modernes Auto in Schräglage mit Schleuderspuren – Strassenglätte. */
export function SlipperyCarIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <g transform="rotate(-14 12 9.5)">
        <path d="M4 12.5h16" />
        <path d="M5.6 12.5 7.2 8.4A2 2 0 0 1 9.1 7.1h5.8a2 2 0 0 1 1.9 1.3l1.6 4.1" />
        <circle cx="8.2" cy="14.6" r="1.5" />
        <circle cx="15.8" cy="14.6" r="1.5" />
      </g>
      <path d="M3.5 20.5c1.7 0 1.7-1.7 3.4-1.7s1.7 1.7 3.4 1.7" />
      <path d="M13.7 20.5c1.7 0 1.7-1.7 3.4-1.7s1.7 1.7 3.4 1.7" />
    </svg>
  );
}
