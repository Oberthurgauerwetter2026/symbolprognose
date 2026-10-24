/** Bilinear native-PNG sampling; only wet/dry edges receive stationary texture.
 * Coordinates are PNG pixels, never screen pixels, so zoom/play cannot move it.
 */
export function sampleRadarBand(
  arr: Float32Array, width: number, height: number,
  fx: number, fy: number, forecast = false,
): number {
  const sample = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const tx = cx - x0, ty = cy - y0;
    return arr[y0 * width + x0] * (1 - tx) * (1 - ty)
      + arr[y0 * width + x1] * tx * (1 - ty)
      + arr[y1 * width + x0] * (1 - tx) * ty
      + arr[y1 * width + x1] * tx * ty;
  };
  const value = sample(fx, fy);
  if (!forecast || value <= 0 || value >= 1.5) return value;
  const x = Math.max(0, Math.min(width - 1, Math.floor(fx)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(fy)));
  const x1 = Math.min(width - 1, x + 1), y1 = Math.min(height - 1, y + 1);
  if (Math.min(arr[y * width + x], arr[y * width + x1],
    arr[y1 * width + x], arr[y1 * width + x1]) > 0) return value;
  // Sub-pixel, continuous domain warp: preserves native fringing without
  // exposing rectangles from either the source grid or nearest-neighbour.
  const dx = 0.38 * Math.sin(fx * 2.17 + fy * 1.31) * Math.cos(fy * 0.73);
  const dy = 0.38 * Math.sin(fy * 2.43 - fx * 1.11) * Math.cos(fx * 0.67);
  return sample(fx + dx, fy + dy);
}