import { describe, expect, it } from 'vitest';
import { currentWeatherSlot } from './current-weather-slot';

describe('weather at the current hour', () => {
  it('selects 22:00 Swiss time at 21:31 UTC rather than browser time', () => {
    expect(currentWeatherSlot(['2026-11-27T21:00', '2026-11-27T22:00', '2026-11-27T23:00'], 'Europe/Zurich', new Date('2026-11-27T21:31:00Z'))).toBe(1);
  });
  it('does not present an old forecast as current weather', () => {
    expect(currentWeatherSlot(['2026-11-26T22:00'], 'Europe/Zurich', new Date('2026-11-27T21:31:00Z'))).toBeNull();
  });
});