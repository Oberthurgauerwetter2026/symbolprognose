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

/** Einzelner Blitz – Gewitter (gefüllte, markante Silhouette). */
export function BoltIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <path
        d="M14.4 1.8 5.6 13.1a.6.6 0 0 0 .48.97h4.1l-1.6 7.4a.45.45 0 0 0 .8.36l8.9-11.4a.6.6 0 0 0-.47-.97h-4.2l1.6-7.3a.45.45 0 0 0-.81-.36z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Drei plastische Regentropfen. */
export function RainDropsIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  const drop = (cx: number, cy: number, s: number) =>
    `M ${cx} ${cy - 4.6 * s}
     C ${cx + 1.1 * s} ${cy - 2.4 * s} ${cx + 3.1 * s} ${cy - 0.9 * s} ${cx + 3.1 * s} ${cy + 0.7 * s}
     a ${3.1 * s} ${3.1 * s} 0 0 1 ${-6.2 * s} 0
     c 0 ${-1.6 * s} ${2 * s} ${-3.1 * s} ${3.1 * s} ${-5.3 * s} z`;
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <path d={drop(6.6, 7.4, 1)} fill="currentColor" stroke="currentColor" strokeWidth={1} />
      <path d={drop(17.4, 7.4, 1)} fill="currentColor" stroke="currentColor" strokeWidth={1} />
      <path d={drop(12, 16.6, 1)} fill="currentColor" stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}

/** Sechsstrahliger Kristall mit Seitenästen. */
function crystal(k: string) {
  return (
    <g key={k}>
      <path d="M12 2.6v18.8" />
      <path d="M3.86 7.3 20.14 16.7" />
      <path d="M20.14 7.3 3.86 16.7" />
      <path d="M9.4 5.1 12 7.1l2.6-2" />
      <path d="M9.4 18.9 12 16.9l2.6 2" />
      <path d="M4.5 11.2 4.1 8.2l2.9-.9" />
      <path d="M19.5 12.8l.4 3-2.9.9" />
      <path d="M19.5 11.2l.4-3-2.9-.9" />
      <path d="M4.5 12.8l-.4 3 2.9.9" />
    </g>
  );
}

/** Einfacher 6-Strahl-Stern für kleine Flocken. */
function star(k: string) {
  return (
    <g key={k}>
      <path d="M12 3v18" />
      <path d="M4.2 7.5 19.8 16.5" />
      <path d="M19.8 7.5 4.2 16.5" />
    </g>
  );
}

/** Drei Schneekristalle (eine grosse, zwei kleine). */
export function SnowflakesIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em" strokeWidth={1.6}>
      <g transform="translate(8.8 8.8) scale(0.68) translate(-12 -12)">{crystal("big")}</g>
      <g transform="translate(18.6 7.4) scale(0.28) translate(-12 -12)" strokeWidth={4.6}>
        {star("s1")}
      </g>
      <g transform="translate(15.4 18.6) scale(0.32) translate(-12 -12)" strokeWidth={4.2}>
        {star("s2")}
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

/**
 * Strassenglätte – klassisches Verkehrszeichen «Schleudergefahr»:
 * Auto von hinten mit zwei geschwungenen Schleuderspuren darunter.
 */
export function SlipperyCarIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em" strokeWidth={1.6}>
      {/* Dach & Heckscheibe */}
      <path d="M7.6 8.2 8.9 5.2A1.8 1.8 0 0 1 10.55 4.1h2.9c.72 0 1.37.43 1.65 1.1l1.3 3" />
      {/* Karosserie */}
      <path d="M5 13.4v-2.2c0-1.6 1.3-3 3-3h8c1.7 0 3 1.4 3 3v2.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      {/* Rückleuchten */}
      <path d="M7.4 11.4h1.6" />
      <path d="M15 11.4h1.6" />
      {/* Räder */}
      <path d="M7.6 14.4v1.1" />
      <path d="M16.4 14.4v1.1" />
      {/* Schleuderspuren */}
      <path d="M3.4 21.4c1.6 0 1.9-2.4 3.5-2.4s1.9 2.4 3.5 2.4" />
      <path d="M13.6 21.4c1.6 0 1.9-2.4 3.5-2.4s1.9 2.4 3.5 2.4" />
    </svg>

  );
}
