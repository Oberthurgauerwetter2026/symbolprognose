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

/** Auto in Schräglage mit Schleuderspuren – Strassenglätte. */
export function SlipperyCarIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <g transform="rotate(-12 12 10)">
        <path d="M4.5 12.5 6 8.2A2 2 0 0 1 7.9 6.8h6.2A2 2 0 0 1 16 8.2l1.5 4.3" />
        <path d="M3.6 12.5h16.8" />
        <path d="M4.6 12.5v2.6a.9.9 0 0 0 .9.9h1a.9.9 0 0 0 .9-.9v-.9" />
        <path d="M19.4 12.5v2.6a.9.9 0 0 1-.9.9h-1a.9.9 0 0 1-.9-.9v-.9" />
      </g>
      <path d="M3 20.5c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6" />
      <path d="M14 20.5c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6" />
    </svg>
  );
}

/** Windsack am Mast – Wind. */
export function WindsockIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...rest} className={className} width="1em" height="1em">
      <path d="M5 3v18" />
      <path d="M3 21h5" />
      <path d="M5 5.5h10.5a4 4 0 0 1 3.6 2.3l1.4 2.9-1.4 2.9a4 4 0 0 1-3.6 2.3H5z" />
      <path d="M9.5 5.5v10.4" />
      <path d="M13.5 5.7v10" />
      <path d="M17 6.8v7.8" />
    </svg>
  );
}
