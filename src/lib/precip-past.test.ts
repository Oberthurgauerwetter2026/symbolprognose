import { test } from "node:test";
import assert from "node:assert/strict";
const expect = (v: number) => ({ toBe: (e: number) => assert.equal(v, e) });
import { sumPastHours } from "./precip-past";

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
