/** Switzerland with a margin for Lake Geneva, Lake Constance and Ticino. */
export const SATELLITE_SWISS_BOUNDS: [[number, number], [number, number]] = [
  [45.75, 5.9],
  [47.85, 10.55],
];

export const SATELLITE_FIT_PADDING = 12;

/** Never zoom in beyond the regional view or beyond the fitting zoom. */
export function satelliteFitZoom(boundsZoom: number, regionZoom: number, loop = false): number {
  const steps = loop ? 1 : 4;
  const maximum = loop ? 9 : regionZoom;
  return Math.max(0, Math.min(maximum, Math.floor(boundsZoom * steps) / steps));
}