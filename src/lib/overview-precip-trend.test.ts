import { describe, expect, it } from 'vitest';
import { overviewPrecipTrend } from './overview-precip-trend';

const now = new Date('2026-11-27T21:54:00Z');
const hours = { time: ['2026-11-27T22:00', '2026-11-27T23:00', '2026-11-28T00:00', '2026-11-28T01:00'], precipitation: [0, 0, 0, 0], weathercode: [3, 3, 3, 3], snowfall: [0, 0, 0, 0] };
describe('local precipitation outlook', () => {
  it('reports dry only with complete coverage', () => {
    expect(overviewPrecipTrend(hours, 'Europe/Zurich', now)).toEqual({ phase: 'dry', time: null });
  });
  it('locates upcoming rain in Swiss local time across midnight', () => {
    expect(overviewPrecipTrend({ ...hours, precipitation: [0, 0, 0.6, 0] }, 'Europe/Zurich', now)).toEqual({ phase: 'rain', time: '00:00' });
  });
  it('distinguishes snow from rain', () => {
    expect(overviewPrecipTrend({ ...hours, weathercode: [3, 71, 3, 3], snowfall: [0, 0.2, 0, 0] }, 'Europe/Zurich', now)).toEqual({ phase: 'snow', time: '23:00' });
  });
  it('distinguishes sleet and freezing rain', () => {
    expect(overviewPrecipTrend({ ...hours, weathercode: [68, 3, 3, 3] }, 'Europe/Zurich', now)?.phase).toBe('sleet');
    expect(overviewPrecipTrend({ ...hours, weathercode: [66, 3, 3, 3] }, 'Europe/Zurich', now)?.phase).toBe('freezing-rain');
  });
  it('does not claim dry with stale, missing or discontinuous data', () => {
    expect(overviewPrecipTrend(hours, 'Europe/Zurich', new Date('2026-11-28T21:54:00Z'))).toBeNull();
    expect(overviewPrecipTrend({ ...hours, precipitation: [0, NaN, 0, 0] }, 'Europe/Zurich', now)).toBeNull();
    expect(overviewPrecipTrend({ ...hours, time: [hours.time[0] ?? '', hours.time[1] ?? '', hours.time[3] ?? '', '2026-11-28T02:00'] }, 'Europe/Zurich', now)).toBeNull();
  });
  it('includes precipitation in the current hour instead of claiming dry', () => {
    expect(overviewPrecipTrend({ ...hours, precipitation: [1.2, 0, 0, 0] }, 'Europe/Zurich', now)).toEqual({ phase: 'rain', time: null });
  });
});