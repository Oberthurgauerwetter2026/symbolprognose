import { test } from "node:test";
import assert from "node:assert/strict";
const expect = (v: number) => ({ toBe: (e: number) => assert.equal(v, e) });
import { sumNextHours, sumPastHours } from "./precip-past";

const H = 3_600_000;
const now = 100 * H;
const times = Array.from({ length: 100 }, (_, i) => (i + 1) * H); // 1h..100h
const ones = times.map(() => 1);

test("12-h-Fenster summiert genau 12 Stunden", () => {
  expect(sumPastHours(times, ones, now, 12)).toBe(12);
});

test("72-h-Fenster summiert genau 72 Stunden", () => {
  expect(sumPastHours(times, ones, now, 72)).toBe(72);
});

test("Zukünftige Stunden zählen nicht", () => {
  expect(sumPastHours([now + H], [5], now, 12)).toBe(0);
});

test("Fehlende Werte werden übersprungen", () => {
  expect(sumPastHours([now - H, now], [null, 2], now, 12)).toBe(2);
});

const H2 = 3_600_000;
const now2 = 100 * H2;
const times2 = [99, 100, 101, 112, 113, 172, 173].map((h) => h * H2);
const vals2 = [5, 5, 1, 2, 4, 8, 16];
test("sumNextHours: 12 h zählt nur Stunden nach jetzt bis +12 h", () => {
  expect(sumNextHours(times2, vals2, now2, 12)).toBe(3);
});
test("sumNextHours: 72 h schliesst Stunde 172 ein, 173 aus", () => {
  expect(sumNextHours(times2, vals2, now2, 72)).toBe(15);
});
test("sumNextHours: überspringt fehlende Werte", () => {
  expect(sumNextHours([101 * H2], [null], now2, 12)).toBe(0);
});
