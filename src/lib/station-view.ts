/** Explicit shared links keep their selection; a new sums view starts with temperature. */
export function initialSumMetric(metric?: 'temperature' | 'rain' | 'wind') {
  return metric ?? 'temperature';
}