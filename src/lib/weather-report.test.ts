import { describe, it, expect } from 'vitest';
import { nextWeekday, reportDays, reportSchema } from './weather-report';
import { nearestLiveStation } from './weather-overview';

describe('editorial weather report', () => {
  const input = {
    title: 'Zäher Hochnebel am See', situation: 'Ein Hoch bestimmt das Wetter.', forecast_title: 'Prognose bis Samstagabend',
    forecast: 'Hochnebel mit sonnigen Phasen.', outlook_title: 'Aussichten bis Mittwoch',
    days: [{ label: 'Sonntag', text: 'Tiefer Hochnebel.' }], trend: 'Hochdruckeinfluss.',
  };
  it('keeps the sections of a complete report', () => {
    expect(reportSchema.parse(input)).toEqual(input);
  });
  it('requires a title and a forecast, the other sections may stay empty', () => {
    for (const key of ['title', 'forecast']) expect(reportSchema.safeParse({ ...input, [key]: ' ' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...input, situation: '', forecast_title: '', outlook_title: '', days: [], trend: '' }).success).toBe(true);
  });
  it('rejects an outlook day without weekday or text', () => {
    expect(reportSchema.safeParse({ ...input, days: [{ label: '', text: 'Nebel.' }] }).success).toBe(false);
    expect(reportSchema.safeParse({ ...input, days: [{ label: 'Montag', text: '' }] }).success).toBe(false);
  });
  it('drops incomplete stored days instead of failing the whole report', () => {
    expect(reportDays([{ label: 'Montag', text: 'Regen.' }, { label: 'Dienstag' }, null])).toEqual([{ label: 'Montag', text: 'Regen.' }]);
    expect(reportDays(null)).toEqual([]);
  });
  it('suggests the weekday after the last outlook day, or tomorrow for the first one', () => {
    expect(nextWeekday([{ label: 'Sonntag' }], new Date('2026-11-28T10:00:00Z'))).toBe('Montag');
    expect(nextWeekday([], new Date('2026-11-28T10:00:00Z'))).toBe('Sonntag');
    expect(nextWeekday([{ label: 'Wochenende' }], new Date('2026-11-28T10:00:00Z'))).toBe('');
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