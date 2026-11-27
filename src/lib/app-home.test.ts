import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { shouldResumeOnHome } from './app-home';

describe('main weather app opens on home', () => {
  it('launches at the start page', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as { start_url: string };
    expect(manifest.start_url).toBe('/');
  });
  it('returns installed public product views home on reopening', () => {
    expect(shouldResumeOnHome(true, '/karten/lokal')).toBe(true);
    expect(shouldResumeOnHome(true, '/karten/radar')).toBe(true);
  });
  it('preserves normal browser navigation, embeds and separate admin/warning apps', () => {
    expect(shouldResumeOnHome(false, '/karten/lokal')).toBe(false);
    expect(shouldResumeOnHome(true, '/embed/lokal')).toBe(false);
    expect(shouldResumeOnHome(true, '/admin-ticker')).toBe(false);
    expect(shouldResumeOnHome(true, '/warnkarte')).toBe(false);
  });
});