import { describe, expect, it } from 'vitest';
import { pointOutlook, pointPhase, radarDryRadiusKm, regionalDryOutlook, type PointSample } from './point-nowcast';
const now = Date.parse('2026-11-27T22:05:00Z');
const minute = 60_000;
const dry = (): PointSample[] => Array.from({ length: 13 }, (_, i) => ({ t: now + i * 5 * minute, phase: 'dry' }));
describe('point radar outlook', () => {
  it('reports 60 minutes dry only with continuous coverage', () => {
    expect(pointOutlook(dry(), now, now)).toEqual({ phase: 'dry', minutes: 0, horizon: 60 });
  });
  it.each(['rain', 'sleet', 'snow'] as const)('reports %s arriving in approximately 25 minutes', phase => {
    const samples = dry();
    samples[5] = { t: now + 25 * minute, phase };
    expect(pointOutlook(samples, now, now)).toEqual({ phase, minutes: 25, horizon: 60 });
  });
  it('reports current precipitation at minute zero', () => {
    expect(pointOutlook([{ t: now, phase: 'snow' }], now, now)?.minutes).toBe(0);
  });
  it('does not infer dry or arrival across missing images', () => {
    const samples = dry();
    samples[2] = { t: now + 10 * minute, phase: null };
    samples[5] = { t: now + 25 * minute, phase: 'rain' };
    expect(pointOutlook(samples, now, now)).toBeNull();
    expect(pointOutlook(dry().filter((_, i) => i !== 2), now, now)).toBeNull();
  });
  it('offers 30 minutes when only that horizon is covered', () => {
    expect(pointOutlook(dry().slice(0, 7), now, now)).toEqual({ phase: 'dry', minutes: 0, horizon: 30 });
  });
  it('rejects stale observations and absent point coverage', () => {
    expect(pointOutlook(dry(), now - 21 * minute, now)).toBeNull();
    expect(pointOutlook([], now, now)).toBeNull();
  });
  it('uses the same categorical phase codes as radar', () => {
    expect([0, 245, 230, 215, 200].map(pointPhase)).toEqual(['dry', 'rain', 'sleet', 'snow', 'freezing-rain']);
  });
});

describe('measured large-area dry fallback', () => {
  const bbox = { minLat: 46, maxLat: 50, minLon: 6, maxLon: 12 };
  const location = { lat: 48, lon: 9 };
  const width = 121;
  const height = 81;
  const image = () => new Uint8ClampedArray(width * height * 4);
  it('offers 60 minutes from a fully covered dry measured image without a motion vector', () => {
    const radius = radarDryRadiusKm(image(), width, height, bbox, location);
    expect(regionalDryOutlook(radius, now - 10 * minute, now)).toEqual({ phase: 'dry', minutes: 0, horizon: 60 });
  });
  it('offers 30 minutes when 60 minutes cannot be covered', () => {
    expect(regionalDryOutlook(80, now, now)).toEqual({ phase: 'dry', minutes: 0, horizon: 30 });
  });
  it('consumes dry distance for the observation age', () => {
    expect(regionalDryOutlook(100, now - 10 * minute, now)?.horizon).toBe(30);
    expect(regionalDryOutlook(60, now - 10 * minute, now)).toBeNull();
  });
  it.each([200, 215, 230, 245])('rejects nearby precipitation of any phase (%s)', alpha => {
    const rgba = image();
    rgba[(40 * width + 61) * 4 + 3] = alpha;
    expect(regionalDryOutlook(radarDryRadiusKm(rgba, width, height, bbox, location), now, now)).toBeNull();
  });
  it('limits dry coverage at image edges', () => {
    expect(regionalDryOutlook(radarDryRadiusKm(image(), width, height, bbox, { lat: 46.1, lon: 9 }), now, now)).toBeNull();
  });
  it('rejects missing, stale, future and invalid observations', () => {
    expect(regionalDryOutlook(null, now, now)).toBeNull();
    expect(regionalDryOutlook(200, now - 21 * minute, now)).toBeNull();
    expect(regionalDryOutlook(200, now + minute, now)).toBeNull();
    expect(regionalDryOutlook(NaN, now, now)).toBeNull();
    expect(radarDryRadiusKm(new Uint8ClampedArray(0), width, height, bbox, location)).toBeNull();
    expect(radarDryRadiusKm(image(), width, height, bbox, { lat: 51, lon: 9 })).toBeNull();
  });
});