import { currentWeatherSlot, upcomingWeatherSlots } from './current-weather-slot';

type TrendHours = { time: string[]; precipitation: number[]; weathercode: number[]; snowfall: number[] };
export type PrecipTrend = { phase: 'dry' | 'rain' | 'snow' | 'sleet' | 'freezing-rain'; time: string | null };

/** Local hourly outlook, not a radar arrival estimate. Missing coverage must never mean dry. */
export function overviewPrecipTrend(hours: TrendHours, timezone: string, now = new Date()): PrecipTrend | null {
  const current = currentWeatherSlot(hours.time, timezone, now);
  const future = upcomingWeatherSlots(hours.time, timezone, now).slice(0, 3);
  if (current === null || future.length !== 3) return null;
  const indices = [current, ...future];
  let firstWet: PrecipTrend | null = null;
  let previousStamp: number | null = null;
  for (const index of indices) {
    const time = hours.time[index];
    const amount = hours.precipitation[index];
    const code = hours.weathercode[index];
    if (!time || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || typeof code !== 'number' || !Number.isFinite(code)) return null;
    const stamp = Date.parse(`${time.replace(/Z$/, '')}Z`);
    if (previousStamp !== null && stamp - previousStamp !== 3_600_000) return null;
    previousStamp = stamp;
    const snow = hours.snowfall[index];
    const snowCode = [71, 73, 75, 77, 85, 86].includes(code);
    const sleetCode = [68, 69, 83, 84].includes(code);
    const wetCode = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
    if (!firstWet && (amount >= 0.1 || snowCode || sleetCode || wetCode || (typeof snow === 'number' && Number.isFinite(snow) && snow > 0))) {
      const phase = [56, 57, 66, 67].includes(code) ? 'freezing-rain' : sleetCode ? 'sleet' : snowCode || (typeof snow === 'number' && snow > 0) ? 'snow' : 'rain';
      firstWet = { phase, time: index === current ? null : time.slice(11, 16) };
    }
  }
  return firstWet ?? { phase: 'dry', time: null };
}