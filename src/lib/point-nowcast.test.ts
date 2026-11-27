import { describe, expect, it } from 'vitest';
import { pointOutlook, pointPhase, type PointSample } from './point-nowcast';
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