import { describe, expect, it } from 'vitest';
import { currentWeatherSlot, upcomingWeatherSlots } from './current-weather-slot';

describe('weather at the current hour', () => {
  it('selects 22:00 Swiss time at 21:31 UTC rather than browser time', () => {
    expect(currentWeatherSlot(['2026-11-27T21:00', '2026-11-27T22:00', '2026-11-27T23:00'], 'Europe/Zurich', new Date('2026-11-27T21:31:00Z'))).toBe(1);
  });
  it('does not present an old forecast as current weather', () => {
    expect(currentWeatherSlot(['2026-11-26T22:00'], 'Europe/Zurich', new Date('2026-11-27T21:31:00Z'))).toBeNull();
  });
});

describe('upcoming local forecast hours', () => {
  it('shows future Swiss hours across midnight, not past or distant hours', () => {
    const times = ['2026-11-27T22:00', '2026-11-27T23:00', '2026-11-28T00:00', '2026-11-28T06:00', '2026-11-28T07:00'];
    expect(upcomingWeatherSlots(times, 'Europe/Zurich', new Date('2026-11-27T21:51:00Z'))).toEqual([1, 2, 3]);
  });
  it('does not present stale forecasts as upcoming', () => {
    expect(upcomingWeatherSlots(['2026-11-26T23:00'], 'Europe/Zurich', new Date('2026-11-27T21:51:00Z'))).toEqual([]);
  });
});