/** Missing hourly values are unavailable (-1), never a dry-weather zero. */
export function completeWindowSum(times: number[], values: (number | null)[], now: number, hours: number, future: boolean): number {
  const start = future ? now : now - hours * 3_600_000;
  const end = future ? now + hours * 3_600_000 : now;
  let count = 0;
  let total = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= start || times[i] > end) continue;
    const value = values[i];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    count++;
    total += value;
  }
  return count === hours ? total : -1;
}