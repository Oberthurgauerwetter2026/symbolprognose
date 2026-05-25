// Instrumental Swiss weather icon set — monochrome line icons with red accent.
// All icons share viewBox 0 0 64 64 and use currentColor for the stroke.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const C = {
  sun: "var(--wx-sun)",
  sunCore: "var(--wx-sun-core)",
  moon: "var(--wx-moon)",
  moonShade: "var(--wx-moon-shade)",
  cloud: "var(--wx-cloud)",
  cloudShade: "var(--wx-cloud-shade)",
  cloudDark: "var(--wx-cloud-dark)",
  cloudDarkShade: "var(--wx-cloud-dark-shade)",
  rain: "var(--wx-rain)",
  rainEdge: "var(--wx-rain-edge)",
  snow: "var(--wx-snow)",
  snowEdge: "var(--wx-snow-edge)",
  bolt: "var(--wx-bolt)",
  boltEdge: "var(--wx-bolt-edge)",
  fog: "var(--wx-fog)",
};

function Svg({
  size = 48,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Reusable shapes ---------- */

function Sun({
  cx = 32,
  cy = 32,
  r = 11,
  rays = true,
}: {
  cx?: number;
  cy?: number;
  r?: number;
  rays?: boolean;
}) {
  const rayLen = r * 0.7;
  const rayGap = r * 0.4;
  const rayW = r * 0.35;
  // 8 rays at 0°,45°,90°,...
  const rs = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      {rays &&
        rs.map((deg) => (
          <rect
            key={deg}
            x={cx - rayW / 2}
            y={cy - r - rayGap - rayLen}
            width={rayW}
            height={rayLen}
            rx={rayW / 2}
            fill={C.sun}
            transform={`rotate(${deg} ${cx} ${cy})`}
          />
        ))}
      <circle cx={cx} cy={cy} r={r} fill={C.sun} />
      <circle cx={cx} cy={cy} r={r * 0.7} fill={C.sunCore} />
    </g>
  );
}

function Moon({ cx = 32, cy = 32, r = 12 }: { cx?: number; cy?: number; r?: number }) {
  // Crescent via two overlapping circles using mask
  const id = `moon-mask-${cx}-${cy}-${r}`;
  return (
    <g>
      <defs>
        <mask id={id}>
          <rect width="64" height="64" fill="white" />
          <circle cx={cx + r * 0.55} cy={cy - r * 0.25} r={r * 0.95} fill="black" />
        </mask>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={C.moon} mask={`url(#${id})`} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={C.moonShade}
        mask={`url(#${id})`}
        opacity="0.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={C.moonShade}
        strokeWidth="1.2"
        mask={`url(#${id})`}
      />
    </g>
  );
}

// A puffy cumulus cloud. Pass scale (1 = full size) and offset for translation.
// Returns body + darker underside shadow + thin outline for contrast.
function Cloud({
  x = 32,
  y = 38,
  scale = 1,
  dark = false,
}: {
  x?: number;
  y?: number;
  scale?: number;
  dark?: boolean;
}) {
  const body = dark ? C.cloudDark : C.cloud;
  const shade = dark ? C.cloudDarkShade : C.cloudShade;
  // Base cloud path centered at (0,0), width ~40, height ~20
  const path =
    "M -18 6 C -25 6 -27 -2 -22 -6 C -22 -12 -14 -14 -10 -10 C -7 -16 3 -16 6 -10 C 12 -13 20 -8 19 -2 C 24 -2 25 5 21 7 C 19 9 17 10 14 10 L -16 10 C -18 10 -19 9 -19 7 Z";
  const shadePath =
    "M -19 4 C -19 9 -17 11 -14 11 L 16 11 C 19 11 22 9 22 5 C 19 9 14 10 9 9 C 4 11 -3 11 -7 9 C -12 11 -17 10 -19 4 Z";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={path} fill={body} stroke={shade} strokeWidth="1" strokeLinejoin="round" />
      <path d={shadePath} fill={shade} />
    </g>
  );
}

function Drop({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  // Tear-drop pointing down, ~5×7 at size=1
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size})`}
      d="M 0 -3.5 C 2.4 -0.5 2.4 3 0 3.5 C -2.4 3 -2.4 -0.5 0 -3.5 Z"
      fill={C.rain}
    />
  );
}

function Flake({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  // 6-arm star
  const arms = [0, 60, 120];
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      {arms.map((deg) => (
        <line
          key={deg}
          x1="-3.5"
          y1="0"
          x2="3.5"
          y2="0"
          stroke={C.snow}
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
      {arms.map((deg) => (
        <line
          key={`e-${deg}`}
          x1="-3.5"
          y1="0"
          x2="3.5"
          y2="0"
          stroke={C.snowEdge}
          strokeWidth="0.8"
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle cx="0" cy="0" r="1" fill={C.snow} />
    </g>
  );
}

function Bolt() {
  return (
    <path
      d="M 33 41 L 24 55 L 30 55 L 26 63 L 38 49 L 32 49 L 36 41 Z"
      fill={C.bolt}
      stroke={C.boltEdge}
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  );
}

/* ---------- Icons ---------- */

export function IconClear({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={32} cy={32} r={12} />
    </Svg>
  );
}

export function IconClearNight({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Moon cx={32} cy={32} r={14} />
    </Svg>
  );
}

export function IconMostlyClear({
  size,
  isDay = true,
  ...rest
}: IconProps & { isDay?: boolean }) {
  return (
    <Svg size={size} {...rest}>
      {isDay ? <Sun cx={24} cy={22} r={9} /> : <Moon cx={24} cy={22} r={10} />}
      <Cloud x={38} y={42} scale={0.7} />
    </Svg>
  );
}

export function IconPartlyCloudy({
  size,
  isDay = true,
  ...rest
}: IconProps & { isDay?: boolean }) {
  return (
    <Svg size={size} {...rest}>
      {isDay ? <Sun cx={20} cy={20} r={9} /> : <Moon cx={20} cy={20} r={10} />}
      <Cloud x={36} y={40} scale={1} />
    </Svg>
  );
}

export function IconCloudy({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={34} scale={1.15} />
    </Svg>
  );
}

export function IconFog({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={28} scale={1} />
      <line x1="10" y1="46" x2="54" y2="46" stroke={C.fog} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="52" x2="50" y2="52" stroke={C.fog} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="58" x2="44" y2="58" stroke={C.fog} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconDrizzle({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={28} scale={1} />
      <Drop x={22} y={50} size={0.85} />
      <Drop x={32} y={52} size={0.85} />
      <Drop x={42} y={50} size={0.85} />
    </Svg>
  );
}

export function IconRain({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={28} scale={1} />
      <Drop x={20} y={50} size={1.15} />
      <Drop x={28} y={54} size={1.15} />
      <Drop x={36} y={50} size={1.15} />
      <Drop x={44} y={54} size={1.15} />
    </Svg>
  );
}

export function IconSnow({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={28} scale={1} />
      <Flake x={20} y={50} size={1} />
      <Flake x={32} y={55} size={1.1} />
      <Flake x={44} y={50} size={1} />
    </Svg>
  );
}

export function IconThunderstorm({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={28} scale={1.05} dark />
      <Drop x={20} y={52} size={1} />
      <Drop x={46} y={52} size={1} />
      <Bolt />
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
