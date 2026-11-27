import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE, SCALE, SNOW_SCALE } from './radar-palette';
import { mercatorLat, mercatorLon, previewPoint, renderRadarStill, sampleGrid, type PreviewView } from './tile-preview';

const view: PreviewView = { w: 100, h: 100, x0: 0.524, y0: 0.348, x1: 0.528, y1: 0.351 };
const box = { minLat: mercatorLat(view.y1), maxLat: mercatorLat(view.y0), minLon: mercatorLon(view.x0), maxLon: mercatorLon(view.x1) };
const uniform = (rgb: number[], alpha: number) => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i++) data.set([rgb[0]!, rgb[1]!, rgb[2]!, alpha], i * 4);
  return { w: 4, h: 4, data };
};
const centre = (out: Uint8ClampedArray) => Array.from(out.slice((5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 4));

describe('Kachel-Standbilder', () => {
  it('legt Orte an ihre Stelle im Kartenausschnitt', () => {
    const p = previewPoint(view, mercatorLat(0.3495), mercatorLon(0.526));
    expect(p.x).toBeCloseTo(0.5, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
  });
  it('färbt Regen mit der Anzeige-Palette der Radarkarte', () => {
    expect(centre(renderRadarStill(uniform(SCALE[3]!.rgb, 255), box, view, 10, 10))).toEqual([...DISPLAY_SCALE[3]!.rgb, 255]);
  });
  it('zeigt Schnee in der Schneefarbe statt als Regen', () => {
    expect(centre(renderRadarStill(uniform(SCALE[0]!.rgb, 215), box, view, 10, 10)).slice(0, 3)).toEqual(SNOW_SCALE[0]!.rgb);
  });
  it('lässt trockene Flächen leer', () => {
    expect(centre(renderRadarStill(uniform([0, 0, 0], 0), box, view, 10, 10))).toEqual([0, 0, 0, 0]);
  });
  it('liefert ausserhalb des Windgitters keinen Wert', () => {
    expect(sampleGrid([1, 2, 3, 4], [47, 48], [9, 10], 47.5, 9.5)).toBeCloseTo(2.5);
    expect(sampleGrid([1, 2, 3, 4], [47, 48], [9, 10], 49, 9.5)).toBeNull();
  });
});
