/**
 * Server-side string renderer for the project's WeatherIcon set.
 * Mirrors `src/components/weather-icons/index.tsx` 1:1 (same SVG paths,
 * same color tokens via CSS variables, same dispatcher logic) so that
 * static HTML embeds (e.g. /api/public/embed/region-lokal-static)
 * show identical icons to the React app.
 *
 * Colors come from `--wx-*` CSS variables — the consuming HTML must
 * define them (see src/styles.css :root tokens).
 */

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

let maskCounter = 0;
function nextMaskId(): string {
  maskCounter = (maskCounter + 1) % 1_000_000;
  return `wxm-${maskCounter}`;
}

function svg(size: number, body: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${body}</svg>`;
}

function sun({ cx = 32, cy = 32, r = 11, rays = true }: { cx?: number; cy?: number; r?: number; rays?: boolean } = {}): string {
  const rayLen = r * 0.7;
  const rayGap = r * 0.4;
  const rayW = r * 0.35;
  const rs = [0, 45, 90, 135, 180, 225, 270, 315];
  let out = "<g>";
  if (rays) {
    for (const deg of rs) {
      out += `<rect x="${cx - rayW / 2}" y="${cy - r - rayGap - rayLen}" width="${rayW}" height="${rayLen}" rx="${rayW / 2}" fill="${C.sun}" transform="rotate(${deg} ${cx} ${cy})"/>`;
    }
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.sun}"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="${C.sunCore}"/>`;
  return out + "</g>";
}

function moon({ cx = 32, cy = 32, r = 12 }: { cx?: number; cy?: number; r?: number } = {}): string {
  const id = nextMaskId();
  return (
    `<g>` +
    `<defs><mask id="${id}"><rect width="64" height="64" fill="white"/>` +
    `<circle cx="${cx + r * 0.55}" cy="${cy - r * 0.25}" r="${r * 0.95}" fill="black"/>` +
    `</mask></defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.moon}" mask="url(#${id})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.moonShade}" mask="url(#${id})" opacity="0.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.moonShade}" stroke-width="1.2" mask="url(#${id})"/>` +
    `</g>`
  );
}

function cloud({ x = 32, y = 38, scale = 1, dark = false }: { x?: number; y?: number; scale?: number; dark?: boolean } = {}): string {
  const body = dark ? C.cloudDark : C.cloud;
  const shade = dark ? C.cloudDarkShade : C.cloudShade;
  const path =
    "M -18 6 C -25 6 -27 -2 -22 -6 C -22 -12 -14 -14 -10 -10 C -7 -16 3 -16 6 -10 C 12 -13 20 -8 19 -2 C 24 -2 25 5 21 7 C 19 9 17 10 14 10 L -16 10 C -18 10 -19 9 -19 7 Z";
  const shadePath =
    "M -19 4 C -19 9 -17 11 -14 11 L 16 11 C 19 11 22 9 22 5 C 19 9 14 10 9 9 C 4 11 -3 11 -7 9 C -12 11 -17 10 -19 4 Z";
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<path d="${path}" fill="${body}" stroke="${shade}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="${shadePath}" fill="${shade}"/>` +
    `</g>`
  );
}

function drop({ x, y, size = 1, tilt = 0 }: { x: number; y: number; size?: number; tilt?: number }): string {
  return (
    `<path transform="translate(${x} ${y}) rotate(${tilt}) scale(${size})" ` +
    `d="M 0 -5 C 2.2 -1.6 3 1 3 2.7 C 3 5 1.5 6.5 0 6.5 C -1.5 6.5 -3 5 -3 2.7 C -3 1 -2.2 -1.6 0 -5 Z" ` +
    `fill="${C.rain}" stroke="${C.rainEdge}" stroke-width="1" stroke-linejoin="round"/>`
  );
}

function flake({ x, y, size = 1 }: { x: number; y: number; size?: number }): string {
  const arms = [0, 60, 120];
  let out = `<g transform="translate(${x} ${y}) scale(${size})">`;
  for (const deg of arms) {
    out += `<line x1="-5" y1="0" x2="5" y2="0" stroke="${C.snowEdge}" stroke-width="3.6" stroke-linecap="round" transform="rotate(${deg})"/>`;
  }
  for (const deg of arms) {
    out += `<line x1="-5" y1="0" x2="5" y2="0" stroke="${C.snow}" stroke-width="2.4" stroke-linecap="round" transform="rotate(${deg})"/>`;
  }
  out += `<circle cx="0" cy="0" r="1.6" fill="${C.snow}" stroke="${C.snowEdge}" stroke-width="0.6"/>`;
  return out + "</g>";
}

function bolt(): string {
  return `<path d="M 33 41 L 24 55 L 30 55 L 26 63 L 38 49 L 32 49 L 36 41 Z" fill="${C.bolt}" stroke="${C.boltEdge}" stroke-width="0.8" stroke-linejoin="round"/>`;
}

// ---------- Variants ----------

function IClear(size: number) { return svg(size, sun({ cx: 32, cy: 32, r: 12 })); }
function IClearNight(size: number) { return svg(size, moon({ cx: 32, cy: 32, r: 14 })); }
function IMostlyClear(size: number, isDay: boolean) {
  return svg(size, (isDay ? sun({ cx: 24, cy: 22, r: 9 }) : moon({ cx: 24, cy: 22, r: 10 })) + cloud({ x: 38, y: 42, scale: 0.7 }));
}
function IPartlyCloudy(size: number, isDay: boolean) {
  return svg(size, (isDay ? sun({ cx: 20, cy: 20, r: 9 }) : moon({ cx: 20, cy: 20, r: 10 })) + cloud({ x: 36, y: 40, scale: 1 }));
}
function ICloudy(size: number) { return svg(size, cloud({ x: 32, y: 34, scale: 1.15 })); }
function IFog(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 28, scale: 1 }) +
      `<line x1="10" y1="46" x2="54" y2="46" stroke="${C.fog}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<line x1="14" y1="52" x2="50" y2="52" stroke="${C.fog}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<line x1="20" y1="58" x2="44" y2="58" stroke="${C.fog}" stroke-width="2.5" stroke-linecap="round"/>`,
  );
}
function IDrizzle(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 24 }) +
      drop({ x: 20, y: 46, size: 0.8, tilt: -12 }) +
      drop({ x: 28, y: 50, size: 0.8, tilt: -12 }) +
      drop({ x: 36, y: 46, size: 0.8, tilt: -12 }) +
      drop({ x: 44, y: 50, size: 0.8, tilt: -12 }),
  );
}
function IRain(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 22 }) +
      drop({ x: 18, y: 44, size: 1.4, tilt: -15 }) +
      drop({ x: 28, y: 48, size: 1.4, tilt: -15 }) +
      drop({ x: 38, y: 44, size: 1.4, tilt: -15 }) +
      drop({ x: 48, y: 48, size: 1.4, tilt: -15 }) +
      drop({ x: 23, y: 54, size: 1.4, tilt: -15 }) +
      drop({ x: 43, y: 54, size: 1.4, tilt: -15 }),
  );
}
function ISnow(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 24 }) +
      flake({ x: 18, y: 44, size: 1.1 }) +
      flake({ x: 32, y: 48, size: 1.2 }) +
      flake({ x: 46, y: 44, size: 1.1 }) +
      flake({ x: 25, y: 55, size: 1 }) +
      flake({ x: 39, y: 55, size: 1 }),
  );
}
function IThunderstorm(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 24, scale: 1.05, dark: true }) +
      drop({ x: 18, y: 48, size: 1.3, tilt: -15 }) +
      drop({ x: 48, y: 48, size: 1.3, tilt: -15 }) +
      bolt(),
  );
}
function ISunShower(size: number) {
  return svg(
    size,
    sun({ cx: 20, cy: 20, r: 9 }) +
      cloud({ x: 38, y: 32 }) +
      drop({ x: 32, y: 50, size: 0.95, tilt: -12 }) +
      drop({ x: 42, y: 54, size: 0.95, tilt: -12 }) +
      drop({ x: 52, y: 50, size: 0.95, tilt: -12 }),
  );
}
function ISunThunder(size: number, intensity: 2 | 3 | 4) {
  let d =
    sun({ cx: 20, cy: 20, r: 9 }) +
    cloud({ x: 38, y: 32, dark: true }) +
    bolt() +
    drop({ x: 44, y: 46, size: 0.9, tilt: -12 }) +
    drop({ x: 56, y: 46, size: 0.9, tilt: -12 });
  if (intensity >= 3) d += drop({ x: 50, y: 54, size: 0.9, tilt: -12 });
  if (intensity >= 4) d += drop({ x: 42, y: 54, size: 0.9, tilt: -12 });
  return svg(size, d);
}
function ISunSnowThunder(size: number, intensity: 2 | 3 | 4) {
  let d =
    sun({ cx: 20, cy: 20, r: 9 }) +
    cloud({ x: 38, y: 32, dark: true }) +
    bolt() +
    flake({ x: 44, y: 46, size: 0.95 }) +
    flake({ x: 56, y: 46, size: 0.95 });
  if (intensity >= 3) d += flake({ x: 50, y: 54, size: 0.95 });
  if (intensity >= 4) d += flake({ x: 42, y: 54, size: 0.95 });
  return svg(size, d);
}
function ISnowThunder(size: number) {
  return svg(
    size,
    cloud({ x: 32, y: 24, scale: 1.05, dark: true }) +
      flake({ x: 20, y: 48, size: 1.1 }) +
      flake({ x: 46, y: 48, size: 1.1 }) +
      bolt(),
  );
}

// ---------- Daily wet picker ----------

function pickWetDaily(opts: {
  size: number;
  sunshineRatio?: number;
  precipHours?: number;
  precip?: number;
  isSnow?: boolean;
}): string {
  if (opts.isSnow) return ISnow(opts.size);
  if ((opts.sunshineRatio ?? 0) >= 0.15 && (opts.precipHours ?? 0) < 8) return ISunShower(opts.size);
  if ((opts.precipHours ?? 0) >= 8 && (opts.precip ?? 0) >= 15) return IRain(opts.size);
  return IDrizzle(opts.size);
}

// ---------- MCH → existing icon set mapping (mirrors mchToIcon) ----------

function renderMchIconSvg(mchCode: number, size: number, isDayOverride?: boolean): string {
  const code = mchCode >= 100 ? mchCode - 100 : mchCode;
  const isNight = typeof isDayOverride === "boolean" ? !isDayOverride : mchCode >= 100;
  const isDay = !isNight;
  switch (code) {
    case 1: return isDay ? IClear(size) : IClearNight(size);
    case 2: return IMostlyClear(size, isDay);
    case 3:
    case 4: return IPartlyCloudy(size, isDay);
    case 5: return ICloudy(size);
    case 6: return IDrizzle(size);
    case 7:
    case 8: return IRain(size);
    case 9: return isDay ? ISunShower(size) : IRain(size);
    case 10:
    case 11:
    case 14: case 15: case 16:
    case 17: case 18: case 19: case 20:
    case 21: case 22: case 23: return ISnow(size);
    case 12: case 13: case 24: case 25: return IThunderstorm(size);
    case 26: return IMostlyClear(size, isDay);
    case 27: return IPartlyCloudy(size, isDay);
    case 28: return ICloudy(size);
    case 29: return IDrizzle(size);
    case 30: return IFog(size);
    case 31: return IThunderstorm(size);
    case 32: return ICloudy(size);
    case 33:
    case 34: return IFog(size);
    case 35: return ISnowThunder(size);
    default: return ICloudy(size);
  }
}

// ---------- Dispatcher (mirrors WeatherIcon) ----------

export interface RenderIconOpts {
  code: number;
  /** MCH-Original-Icon-Code (1–35 Tag, 101–135 Nacht). Wenn vorhanden,
   *  rendert das offizielle MCH-Pictogramm direkt. */
  mchCode?: number;
  isDay?: boolean;
  size?: number;
  precip?: number;
  precipProb?: number;
  isSnow?: boolean;
  scope?: "hourly" | "daily";
  precipHours?: number;
  thunderHours?: number;
  sunshineRatio?: number;
  cloudLow?: number;
  cloudMid?: number;
  cloudHigh?: number;
}

export function renderWeatherIconSvg(o: RenderIconOpts): string {
  const {
    code,
    mchCode,
    size = 48,
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
  } = o;
  const hasMch =
    typeof mchCode === "number" && Number.isFinite(mchCode) && mchCode >= 1;
  const isDay = o.isDay ?? (hasMch ? (mchCode as number) < 100 : true);

  // MCH-Pictogramm hat Vorrang — 1:1 das MeteoSwiss-Symbol, gerendert
  // im bestehenden Icon-Stil (Mondsichel, puffige Wolken).
  if (hasMch) {
    return renderMchIconSvg(mchCode as number, size, o.isDay);
  }



  const wmoIsWet = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
  const wmoIsThunder = code === 95 || code === 96 || code === 99;

  if (scope === "daily" && ((thunderHours ?? 0) >= 1 || wmoIsThunder)) {
    const th = thunderHours ?? 0;
    const sunny = (sunshineRatio ?? 0) >= 0.10 && (precipHours ?? 0) < 10;
    const heavyThunder =
      th >= 4 ||
      (th >= 3 && (precip ?? 0) >= 8) ||
      (wmoIsThunder && (precipHours ?? 0) >= 6 && !sunny);
    const sunIntensity: 2 | 3 | 4 = (precip ?? 0) >= 10 ? 4 : (precip ?? 0) >= 4 ? 3 : 2;
    if (heavyThunder) return isSnow ? ISnowThunder(size) : IThunderstorm(size);
    if (sunny) return isSnow ? ISunSnowThunder(size, sunIntensity) : ISunThunder(size, sunIntensity);
    return isSnow ? ISnowThunder(size) : IThunderstorm(size);
  }

  const wet =
    scope === "hourly"
      ? (precip ?? 0) >= 0.2 || (precipProb ?? 0) >= 60
      : (precipHours ?? 0) >= 6 && ((precip ?? 0) >= 2 || (precipProb ?? 0) >= 70);
  if (wet && !wmoIsWet) {
    if (scope === "daily") return pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow });
    if (isSnow) return ISnow(size);
    const heavy = (precip ?? 0) >= 1.5 || (precipProb ?? 0) >= 80;
    return heavy ? IRain(size) : IDrizzle(size);
  }

  if (isSnow && !wmoIsWet) return ISnow(size);

  const dayHasRain =
    scope === "daily" && !isSnow && ((precipHours ?? 0) >= 1 || (precip ?? 0) >= 0.5);
  if (dayHasRain && !wmoIsWet) {
    return pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow });
  }

  const hasLayers =
    typeof cloudLow === "number" || typeof cloudMid === "number" || typeof cloudHigh === "number";
  if (hasLayers && !wmoIsWet && !dayHasRain && code <= 3) {
    const low = cloudLow ?? 0;
    const mid = cloudMid ?? 0;
    const high = cloudHigh ?? 0;
    if (low >= 60) return ICloudy(size);
    if (low < 30 && mid < 40 && high >= 40) return isDay ? IMostlyClear(size, true) : IClearNight(size);
    if (mid >= 50 && low < 50) return IPartlyCloudy(size, isDay);
    if (low < 20 && mid < 25 && high < 25) return isDay ? IClear(size) : IClearNight(size);
  }

  if (isDay && !wmoIsWet && !dayHasRain && (code === 2 || code === 3) && typeof sunshineRatio === "number") {
    const hiThresh = scope === "hourly" ? 0.65 : 0.55;
    const loThresh = scope === "hourly" ? 0.35 : 0.25;
    if (sunshineRatio >= hiThresh) return IMostlyClear(size, true);
    if (sunshineRatio >= loThresh) return IPartlyCloudy(size, true);
  }

  const isShowerCode =
    (code >= 51 && code <= 57) ||
    (code >= 61 && code <= 65) ||
    (code >= 80 && code <= 82);
  if (scope === "hourly" && isShowerCode && isDay && (sunshineRatio ?? 0) >= 0.3 && (precip ?? 0) < 1) {
    return ISunShower(size);
  }

  if (code === 0) return isDay ? IClear(size) : IClearNight(size);
  if (code === 1) return IMostlyClear(size, isDay);
  if (code === 2) return IPartlyCloudy(size, isDay);
  if (code === 3) return ICloudy(size);
  if (code === 45 || code === 48) return IFog(size);
  if (code >= 51 && code <= 57) return scope === "daily" ? pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow }) : IDrizzle(size);
  if (code >= 61 && code <= 67) return scope === "daily" ? pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow }) : IRain(size);
  if (code >= 71 && code <= 77) return ISnow(size);
  if (code === 80 || code === 81) return scope === "daily" ? pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow }) : IDrizzle(size);
  if (code === 82) return scope === "daily" ? pickWetDaily({ size, sunshineRatio, precipHours, precip, isSnow }) : IRain(size);
  if (code === 85 || code === 86) return ISnow(size);
  if (code >= 95) return IThunderstorm(size);
  return ICloudy(size);
}

/** CSS for `--wx-*` color tokens, inline-ready for the embed `<style>` block. */
export const WX_ICON_CSS_VARS = `:root{
  --wx-sun:#f59e0b;--wx-sun-core:#fbbf24;
  --wx-moon:#fef3c7;--wx-moon-shade:#b45309;
  --wx-cloud:#cbd0d8;--wx-cloud-shade:#6b7280;
  --wx-cloud-dark:#4b5563;--wx-cloud-dark-shade:#1f2937;
  --wx-rain:#38bdf8;--wx-rain-edge:#0c2a4a;
  --wx-snow:#ffffff;--wx-snow-edge:#3b4a5c;
  --wx-bolt:#facc15;--wx-bolt-edge:#b45309;
  --wx-fog:#4b5563;
}`;
