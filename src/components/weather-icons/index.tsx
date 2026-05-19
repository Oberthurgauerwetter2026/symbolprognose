// Instrumental Swiss weather icon set — monochrome line icons with red accent.
// All icons share viewBox 0 0 64 64 and use currentColor for the stroke.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 48, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Primitives ---------- */

const SUN_RAYS = (
  <g>
    <line x1="32" y1="6" x2="32" y2="12" />
    <line x1="32" y1="52" x2="32" y2="58" />
    <line x1="6" y1="32" x2="12" y2="32" />
    <line x1="52" y1="32" x2="58" y2="32" />
    <line x1="13.5" y1="13.5" x2="17.8" y2="17.8" />
    <line x1="46.2" y1="46.2" x2="50.5" y2="50.5" />
    <line x1="13.5" y1="50.5" x2="17.8" y2="46.2" />
    <line x1="46.2" y1="17.8" x2="50.5" y2="13.5" />
  </g>
);

const CLOUD = (
  <path d="M18 44 C12 44 9 39 12 34 C13 28 19 26 23 28 C25 22 33 21 37 26 C42 24 49 27 49 33 C53 33 55 37 53 41 C52 43 49 44 47 44 Z" />
);

const SMALL_CLOUD = (
  <path d="M30 36 C26 36 24 33 26 30 C27 26 32 25 35 27 C37 24 42 25 43 28 C46 28 47 31 45 33 C44 35 42 36 40 36 Z" />
);

/* ---------- Icons ---------- */

export function IconClear({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <circle cx="32" cy="32" r="11" />
      {SUN_RAYS}
    </Svg>
  );
}

export function IconClearNight({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <path d="M42 38 A14 14 0 1 1 26 22 A11 11 0 0 0 42 38 Z" />
    </Svg>
  );
}

export function IconMostlyClear({ size, isDay = true, ...rest }: IconProps & { isDay?: boolean }) {
  return (
    <Svg size={size} {...rest}>
      {isDay ? (
        <>
          <circle cx="24" cy="24" r="8" />
          <g transform="translate(-2 -4)">
            <line x1="24" y1="6" x2="24" y2="10" />
            <line x1="8" y1="24" x2="12" y2="24" />
            <line x1="11" y1="11" x2="13.8" y2="13.8" />
            <line x1="34" y1="11" x2="36.8" y2="13.8" transform="scale(-1 1) translate(-48 0)" />
          </g>
          {SMALL_CLOUD}
        </>
      ) : (
        <>
          <path d="M30 22 A10 10 0 1 1 19 11 A8 8 0 0 0 30 22 Z" />
          {SMALL_CLOUD}
        </>
      )}
    </Svg>
  );
}

export function IconPartlyCloudy({ size, isDay = true, ...rest }: IconProps & { isDay?: boolean }) {
  return (
    <Svg size={size} {...rest}>
      {isDay ? (
        <>
          <circle cx="22" cy="22" r="9" />
          <g>
            <line x1="22" y1="6" x2="22" y2="10" />
            <line x1="6" y1="22" x2="10" y2="22" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" />
            <line x1="34.5" y1="9.5" x2="31.5" y2="12.5" />
          </g>
        </>
      ) : (
        <path d="M30 24 A11 11 0 1 1 18 12 A9 9 0 0 0 30 24 Z" />
      )}
      <path d="M22 48 C16 48 13 43 16 38 C17 33 23 31 27 33 C29 28 36 27 40 31 C44 30 50 33 50 38 C53 38 55 41 53 45 C52 47 50 48 48 48 Z" />
    </Svg>
  );
}

export function IconCloudy({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      {CLOUD}
    </Svg>
  );
}

export function IconFog({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <path d="M18 36 C12 36 9 31 12 26 C13 20 19 18 23 20 C25 14 33 13 37 18 C42 16 49 19 49 25 C53 25 55 29 53 33 C52 35 49 36 47 36 Z" />
      <line x1="10" y1="46" x2="54" y2="46" />
      <line x1="14" y1="52" x2="50" y2="52" />
      <line x1="20" y1="58" x2="44" y2="58" />
    </Svg>
  );
}

export function IconDrizzle({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      {CLOUD}
      <line x1="22" y1="50" x2="20" y2="56" />
      <line x1="32" y1="50" x2="30" y2="56" />
      <line x1="42" y1="50" x2="40" y2="56" />
    </Svg>
  );
}

export function IconRain({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      {CLOUD}
      <line x1="22" y1="49" x2="18" y2="59" strokeWidth={2} />
      <line x1="32" y1="49" x2="28" y2="59" strokeWidth={2} />
      <line x1="42" y1="49" x2="38" y2="59" strokeWidth={2} />
    </Svg>
  );
}

export function IconSnow({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      {CLOUD}
      <g strokeWidth={1.2}>
        <g transform="translate(20 53)">
          <line x1="-3" y1="0" x2="3" y2="0" />
          <line x1="0" y1="-3" x2="0" y2="3" />
          <line x1="-2" y1="-2" x2="2" y2="2" />
          <line x1="-2" y1="2" x2="2" y2="-2" />
        </g>
        <g transform="translate(32 56)">
          <line x1="-3" y1="0" x2="3" y2="0" />
          <line x1="0" y1="-3" x2="0" y2="3" />
          <line x1="-2" y1="-2" x2="2" y2="2" />
          <line x1="-2" y1="2" x2="2" y2="-2" />
        </g>
        <g transform="translate(44 53)">
          <line x1="-3" y1="0" x2="3" y2="0" />
          <line x1="0" y1="-3" x2="0" y2="3" />
          <line x1="-2" y1="-2" x2="2" y2="2" />
          <line x1="-2" y1="2" x2="2" y2="-2" />
        </g>
      </g>
    </Svg>
  );
}

export function IconThunderstorm({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      {CLOUD}
      <line x1="22" y1="49" x2="19" y2="57" />
      <line x1="42" y1="49" x2="39" y2="57" />
      <path
        d="M34 47 L28 57 L32 57 L29 63 L38 53 L34 53 L37 47 Z"
        className="text-accent"
        stroke="currentColor"
        fill="currentColor"
        strokeWidth={1}
      />
    </Svg>
  );
}

/* ---------- Dispatcher ---------- */

export function WeatherIcon({
  code,
  isDay = true,
  size = 48,
  className,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
  className?: string;
}) {
  const props = { size, className };
  if (code === 0) return isDay ? <IconClear {...props} /> : <IconClearNight {...props} />;
  if (code === 1) return <IconMostlyClear isDay={isDay} {...props} />;
  if (code === 2) return <IconPartlyCloudy isDay={isDay} {...props} />;
  if (code === 3) return <IconCloudy {...props} />;
  if (code === 45 || code === 48) return <IconFog {...props} />;
  if (code >= 51 && code <= 57) return <IconDrizzle {...props} />;
  if (code >= 61 && code <= 67) return <IconRain {...props} />;
  if (code >= 71 && code <= 77) return <IconSnow {...props} />;
  if (code === 80 || code === 81) return <IconDrizzle {...props} />;
  if (code === 82) return <IconRain {...props} />;
  if (code === 85 || code === 86) return <IconSnow {...props} />;
  if (code >= 95) return <IconThunderstorm {...props} />;
  return <IconCloudy {...props} />;
}
