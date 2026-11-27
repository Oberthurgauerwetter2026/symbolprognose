/** Local wall-clock milliseconds for comparing timezone-less model timestamps. */
function forecastLocalNow(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return Date.parse(`${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:00Z`);
}

/** Compare local model timestamps in their declared timezone, never the browser's timezone. */
export function currentWeatherSlot(times: string[], timezone: string, now = new Date()): number | null {
  const localNow = forecastLocalNow(timezone, now);
  let best: number | null = null;
  let distance = Infinity;
  times.forEach((time, index) => {
    const delta = localNow - Date.parse(`${time.replace(/Z$/, '')}Z`);
    if (delta >= 0 && delta < 60 * 60 * 1000 && delta < distance) { best = index; distance = delta; }
  });
  return best;
}

/** Only upcoming full hours within the next eight hours; stale data cannot fill the strip. */
export function upcomingWeatherSlots(times: string[], timezone: string, now = new Date()): number[] {
  const localNow = forecastLocalNow(timezone, now);
  return times.map((time, index) => ({ index, stamp: Date.parse(`${time.replace(/Z$/, '')}Z`) }))
    .filter(slot => slot.stamp > localNow && slot.stamp <= localNow + 8 * 60 * 60 * 1000)
    .sort((a, b) => a.stamp - b.stamp)
    .map(slot => slot.index);
}