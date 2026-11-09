import { test } from "node:test";
import assert from "node:assert/strict";
const expect = (v: number) => ({ toBe: (e: number) => assert.equal(v, e), toBeCloseTo: (e: number, d = 2) => assert.ok(Math.abs(v - e) < 10 ** -d / 2 * 10, `${v} ≈ ${e}`) });
import { blendStations } from "./station-blend";
const lat = [47.5, 47.51, 47.52, 47.53, 47.54], lon = [9.2, 9.21, 9.22, 9.23, 9.24];
const flat = (v: number) => new Array(25).fill(v);
test("Station 10.8 mm über 6.1-mm-Fläche hebt den Standort auf 10.8", () => {
  const out = blendStations(flat(6.1), lat, lon, [{ lat: 47.52, lon: 9.22, value: 10.8 }]);
  expect(out[12]).toBeCloseTo(10.8, 1);
});
test("Korrektur auf Faktor 2.5 begrenzt", () => {
  const out = blendStations(flat(2), lat, lon, [{ lat: 47.52, lon: 9.22, value: 50 }]);
  expect(out[12]).toBeCloseTo(5, 1);
});
test("trockene Fläche wird nicht korrigiert", () => {
  const out = blendStations(flat(0), lat, lon, [{ lat: 47.52, lon: 9.22, value: 8 }]);
  expect(out[12]).toBe(0);
});
test("Einfluss klingt mit Distanz ab", () => {
  const big = Array.from({ length: 60 }, (_, i) => 47 + i * 0.01);
  const v = new Array(60 * 5).fill(6);
  const out = blendStations(v, big, lon, [{ lat: 47, lon: 9.22, value: 12 }]);
  expect(out[59 * 5 + 2]).toBeCloseTo(6, 3);
});
