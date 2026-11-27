/** Compare local model timestamps in their declared timezone, never the browser's timezone. */
export function currentWeatherSlot(times: string[], timezone: string, now = new Date()): number | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  const localNow = Date.parse(`${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:00Z`);
  let best: number | null = null;
  let distance = Infinity;
  times.forEach((time, index) => {
    const delta = localNow - Date.parse(`${time.replace(/Z$/, '')}Z`);
    if (delta >= 0 && delta < 60 * 60 * 1000 && delta < distance) { best = index; distance = delta; }
  });
  return best;
}