import { describe, it, expect } from 'vitest';
import { reportSchema } from './weather-report';
import { nearestLiveStation } from './weather-overview';

describe('editorial weather report', () => {
  it('requires all four editorial fields and preserves their content', () => {
    const input = { title: 'Wetter am Bodensee', symbol: 15, summary: 'Schnee am Abend.', body: 'Am Abend sinkt die Schneefallgrenze.' };
    expect(reportSchema.parse(input)).toEqual(input);
    for (const key of ['title', 'summary', 'body']) expect(reportSchema.safeParse({ ...input, [key]: '' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...input, symbol: -1 }).success).toBe(false);
  });
});
describe('current temperature near the visitor', () => {
  const rows = [
    { id: 'near', name: 'Nahe', lat: 47.54, lon: 9.28, min: null, max: null, current: null },
    { id: 'valid', name: 'Messstation', lat: 47.55, lon: 9.29, min: null, max: null, current: 0 },
    { id: 'far', name: 'Weiter weg', lat: 47.6, lon: 9.4, min: null, max: null, current: 4 },
  ];
  it('selects the nearest station with a current temperature, including zero', () => {
    expect(nearestLiveStation(rows, 47.54, 9.28)?.station.id).toBe('valid');
  });
  it('does not invent a temperature when no measurement is available', () => {
    expect(nearestLiveStation(rows.map(s => ({ ...s, current: null })), 47.54, 9.28)).toBeNull();
  });
});