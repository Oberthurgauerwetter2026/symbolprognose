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


/** Windsack am Mast – kräftiger Mast, gefüllter Kegel mit drei Segmenten. */
export function WindsockIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      {/* Mast */}
      <path d="M4.6 4.2v16.6" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      {/* Segment 1 (gross, am Mast) */}
      <path
        d="M5.6 5.4 10.1 6.3v6.1L5.6 13.1z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* Segment 2 */}
      <path
        d="M11.1 6.5 15.2 7.4v4.4l-4.1.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* Segment 3 (Spitze, abgerundet) */}
      <path
        d="M16.2 7.7 18.6 8.2a1.7 1.7 0 0 1 0 3.3l-2.4.4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Strassenglätte – Verkehrszeichen «Schleudergefahr»:
 * flache Auto-Silhouette oben, zwei grosse S-Schleuderspuren darunter.
 */
export function SlipperyCarIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      {/* Karosserie + Kabine, flach und breit */}
      <path
        d="M2.6 11.6v-1.1c0-.95.55-1.8 1.42-2.18l1.5-.66 1.72-2.1A2.4 2.4 0 0 1 9.06 4.7h4.6c.66 0 1.29.27 1.74.75l2.1 2.2 2.28.72c.9.28 1.52 1.12 1.52 2.07v1.16c0 .5-.4.9-.9.9H3.5a.9.9 0 0 1-.9-.9z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* Räder */}
      <rect x="5.1" y="12.5" width="3.4" height="1.7" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="15.5" y="12.5" width="3.4" height="1.7" rx="0.7" fill="currentColor" stroke="none" />
      {/* Zwei grosse Schleuderspuren */}
      <path d="M2.9 21.6c3.4-.3 2.2-4 5.6-4.3" strokeWidth={1.9} />
      <path d="M13.1 21.6c3.4-.3 2.2-4 5.6-4.3" strokeWidth={1.9} />
    </svg>
  );
}


