// Instrumental Swiss weather icon set — monochrome line icons with red accent.
// All icons share viewBox 0 0 64 64 and use currentColor for the stroke.

import type { ReactNode, SVGProps } from "react";

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
}: IconProps & { children: ReactNode }) {
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

function Drop({ x, y, size = 1, tilt = 0 }: { x: number; y: number; size?: number; tilt?: number }) {
  // Schlanker Tropfen: pointed top, round bottom. ~4.4 breit × 9.5 hoch bei size=1.
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${tilt}) scale(${size})`}
      d="M 0 -5 C 2.2 -1.6 3 1 3 2.7 C 3 5 1.5 6.5 0 6.5 C -1.5 6.5 -3 5 -3 2.7 C -3 1 -2.2 -1.6 0 -5 Z"
      fill={C.rain}
      stroke={C.rainEdge}
      strokeWidth="1"
      strokeLinejoin="round"
    />
  );
}

function Flake({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  // 6-arm star with dark edge underneath for contrast
  const arms = [0, 60, 120];
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      {arms.map((deg) => (
        <line
          key={`e-${deg}`}
          x1="-5"
          y1="0"
          x2="5"
          y2="0"
          stroke={C.snowEdge}
          strokeWidth="3.6"
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
      {arms.map((deg) => (
        <line
          key={deg}
          x1="-5"
          y1="0"
          x2="5"
          y2="0"
          stroke={C.snow}
          strokeWidth="2.4"
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle cx="0" cy="0" r="1.6" fill={C.snow} stroke={C.snowEdge} strokeWidth="0.6" />
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
      <Cloud x={32} y={24} scale={1} />
      <Drop x={20} y={46} size={0.8} tilt={-12} />
      <Drop x={28} y={50} size={0.8} tilt={-12} />
      <Drop x={36} y={46} size={0.8} tilt={-12} />
      <Drop x={44} y={50} size={0.8} tilt={-12} />
    </Svg>
  );
}

export function IconRain({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={22} scale={1} />
      <Drop x={18} y={44} size={1.4} tilt={-15} />
      <Drop x={28} y={48} size={1.4} tilt={-15} />
      <Drop x={38} y={44} size={1.4} tilt={-15} />
      <Drop x={48} y={48} size={1.4} tilt={-15} />
      <Drop x={23} y={54} size={1.4} tilt={-15} />
      <Drop x={43} y={54} size={1.4} tilt={-15} />
    </Svg>
  );
}

export function IconSnow({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={24} scale={1} />
      <Flake x={18} y={44} size={1.1} />
      <Flake x={32} y={48} size={1.2} />
      <Flake x={46} y={44} size={1.1} />
      <Flake x={25} y={55} size={1} />
      <Flake x={39} y={55} size={1} />
    </Svg>
  );
}

export function IconThunderstorm({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={24} scale={1.05} dark />
      <Drop x={18} y={48} size={1.3} tilt={-15} />
      <Drop x={48} y={48} size={1.3} tilt={-15} />
      <Bolt />
    </Svg>
  );
}

export function IconSunShower({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={20} cy={20} r={9} />
      <Cloud x={38} y={32} scale={1} />
      <Drop x={32} y={50} size={0.95} tilt={-12} />
      <Drop x={42} y={54} size={0.95} tilt={-12} />
      <Drop x={52} y={50} size={0.95} tilt={-12} />
    </Svg>
  );
}

export function IconSunThunder({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={20} cy={20} r={9} />
      <Cloud x={38} y={32} scale={1} dark />
      <Drop x={32} y={52} size={0.95} tilt={-12} />
      <Bolt />
    </Svg>
  );
}

export function IconSunSnowThunder({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={20} cy={20} r={9} />
      <Cloud x={38} y={32} scale={1} dark />
      <Flake x={32} y={52} size={1} />
      <Bolt />
    </Svg>
  );
}

export function IconSnowThunder({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Cloud x={32} y={24} scale={1.05} dark />
      <Flake x={20} y={48} size={1.1} />
      <Flake x={46} y={48} size={1.1} />
      <Bolt />
    </Svg>
  );
}


/* ---------- Daily wet-icon helper ---------- */

function pickWetDailyIcon({
  sunshineRatio,
  precipHours,
  precip,
  isSnow,
  size,
  className,
}: {
  sunshineRatio?: number;
  precipHours?: number;
  precip?: number;
  isSnow?: boolean;
  size?: number;
  className?: string;
}) {
  const props = { size, className };
  if (isSnow) return <IconSnow {...props} />;
  if ((sunshineRatio ?? 0) >= 0.15 && (precipHours ?? 0) < 8) {
    return <IconSunShower {...props} />;
  }
  if ((precipHours ?? 0) >= 8 && (precip ?? 0) >= 15) {
    return <IconRain {...props} />;
  }
  return <IconDrizzle {...props} />;
}

/* ---------- Dispatcher ---------- */


export function WeatherIcon({
  code,
  isDay = true,
  size = 48,
  className,
  precip,
  precipProb,
  isSnow,
  scope = "hourly",
  precipHours,
  thunderHours,
  sunshineRatio,
  cloudLow,
  cloudMid,
  cloudHigh,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
  className?: string;
  precip?: number;
  precipProb?: number;
  isSnow?: boolean;
  scope?: "hourly" | "daily";
  precipHours?: number;
  thunderHours?: number;
  sunshineRatio?: number;
  /** Wolken-Stockwerke 0–100 (low/mid/high). Trennt Cirrus von echter Bedeckung. */
  cloudLow?: number;
  cloudMid?: number;
  cloudHigh?: number;

}) {
  const props = { size, className };

  // Override: Wenn das Modell selbst klaren Niederschlag prognostiziert,
  // aber den weathercode auf „bedeckt/teils bewölkt" stehen lässt, das Niederschlags-Icon erzwingen.
  const wmoIsWet = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
  const wmoIsThunder = code === 95 || code === 96 || code === 99;
  // Daily-Gewitter, dreistufig:
  //  - Vollgewitter (dunkles Symbol) bei breitem/heftigem Signal
  //  - Sonne+Gewitter-Schauer bei lokal begrenztem Signal mit Sonne
  //  - sonstige Gewitterstunden ohne Sonne → Vollgewitter
  if (scope === "daily" && ((thunderHours ?? 0) >= 1 || wmoIsThunder)) {
    const th = thunderHours ?? 0;
    const heavyThunder =
      th >= 2 ||
      (th >= 1 && (precip ?? 0) >= 8) ||
      (wmoIsThunder && (precipHours ?? 0) >= 3);
    if (heavyThunder) return <IconThunderstorm {...props} />;
    if ((sunshineRatio ?? 0) >= 0.15 && (precipHours ?? 0) < 8) {
      return <IconSunThunder {...props} />;
    }
    return <IconThunderstorm {...props} />;
  }
  // Stündlich: kleine Mengen reichen. Täglich: nur überstimmen, wenn der Regen den Tag prägt
  // (sonst macht ein kurzer Schauer aus einem teils-sonnigen Tag fälschlich „Regen").
  const wet =
    scope === "hourly"
      ? (precip ?? 0) >= 0.2 || (precipProb ?? 0) >= 60
      : (precipHours ?? 0) >= 6 && ((precip ?? 0) >= 2 || (precipProb ?? 0) >= 70);
  if (wet && !wmoIsWet) {
    if (scope === "daily") {
      return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
    }
    if (isSnow) return <IconSnow {...props} />;
    const heavy = (precip ?? 0) >= 1.5 || (precipProb ?? 0) >= 80;
    return heavy ? <IconRain {...props} /> : <IconDrizzle {...props} />;
  }
  // Schnee-Override (gilt für beide Scopes — robustes Tagessignal).
  if (isSnow && !wmoIsWet) return <IconSnow {...props} />;

  // Tages-Override: jeder Niederschlag im 06–21-Fenster muss sichtbar sein,
  // auch wenn der Modus-Code trocken ist.
  const dayHasRain =
    scope === "daily" && !isSnow && ((precipHours ?? 0) >= 1 || (precip ?? 0) >= 0.5);
  if (dayHasRain && !wmoIsWet) {
    return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
  }


  // Wolken-Stockwerke: trennt Cirrus (Sonne scheint durch) von echter Bedeckung.
  // Gilt scope-übergreifend — auch stündlich soll Code 2 + viel low-cloud als bedeckt erscheinen.
  const hasLayers =
    typeof cloudLow === "number" || typeof cloudMid === "number" || typeof cloudHigh === "number";
  if (hasLayers && !wmoIsWet && !dayHasRain && code <= 3) {
    const low = cloudLow ?? 0;
    const mid = cloudMid ?? 0;
    const high = cloudHigh ?? 0;
    if (low >= 60) return <IconCloudy {...props} />;
    if (low < 30 && mid < 40 && high >= 40) {
      return isDay ? <IconMostlyClear isDay {...props} /> : <IconClearNight {...props} />;
    }
    if (mid >= 50 && low < 50) return <IconPartlyCloudy isDay={isDay} {...props} />;
    if (low < 20 && mid < 25 && high < 25) {
      return isDay ? <IconClear {...props} /> : <IconClearNight {...props} />;
    }
  }


  // Sonnen-Korrektiv: bei trockenen Bewölkungs-Codes (2/3) und viel Sonne aufhellen —
  // aber nie auf „wolkenlos" (IconClear). Ein Tag mit Wolken bleibt sichtbar bewölkt.
  // Stündliche Werte sind 0/1-lastig → höhere Schwellen.
  if (isDay && !wmoIsWet && !dayHasRain && (code === 2 || code === 3) && typeof sunshineRatio === "number") {
    const hiThresh = scope === "hourly" ? 0.65 : 0.55;
    const loThresh = scope === "hourly" ? 0.35 : 0.25;
    if (sunshineRatio >= hiThresh) return <IconMostlyClear isDay {...props} />;
    if (sunshineRatio >= loThresh) return <IconPartlyCloudy isDay {...props} />;
  }

  // Sonne-mit-Schauer für stündliche Drizzle-/Schauer-Codes.
  // Wenn parallel viel Sonne scheint und der Niederschlag klein ist, ist es ein Sonnenschauer,
  // kein Dauerregen. Echter Regen (precip >= 1mm oder code 66/67) bleibt unverändert.
  const isShowerCode =
    (code >= 51 && code <= 57) ||
    (code >= 61 && code <= 65) ||
    (code >= 80 && code <= 82);
  if (
    scope === "hourly" &&
    isShowerCode &&
    isDay &&
    (sunshineRatio ?? 0) >= 0.3 &&
    (precip ?? 0) < 1
  ) {
    return <IconSunShower {...props} />;
  }


  if (code === 0) return isDay ? <IconClear {...props} /> : <IconClearNight {...props} />;
  if (code === 1) return <IconMostlyClear isDay={isDay} {...props} />;
  if (code === 2) return <IconPartlyCloudy isDay={isDay} {...props} />;
  if (code === 3) return <IconCloudy {...props} />;
  if (code === 45 || code === 48) return <IconFog {...props} />;

  if (code >= 51 && code <= 57) {
    if (scope === "daily") {
      return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
    }
    return <IconDrizzle {...props} />;
  }
  if (code >= 61 && code <= 67) {
    if (scope === "daily") {
      return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
    }
    return <IconRain {...props} />;
  }
  if (code >= 71 && code <= 77) return <IconSnow {...props} />;
  if (code === 80 || code === 81) {
    if (scope === "daily") {
      return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
    }
    return <IconDrizzle {...props} />;
  }
  if (code === 82) {
    if (scope === "daily") {
      return pickWetDailyIcon({ sunshineRatio, precipHours, precip, isSnow, size, className });
    }
    return <IconRain {...props} />;
  }
  if (code === 85 || code === 86) return <IconSnow {...props} />;
  if (code >= 95) return <IconThunderstorm {...props} />;
  return <IconCloudy {...props} />;
}

