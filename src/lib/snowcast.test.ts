import { describe, it, expect } from "vitest";
import { analyseColumn, sampleRoute, wetBulb, PRESET_ROUTES, type Level } from "./snowcast";

const lv = (z: number, t: number, rh = 95): Level => ({ z, t, rh, ws: 0, wd: 0 });

describe("snowcast", () => {
  it("Feuchtkugel ist bei Sättigung gleich der Temperatur, bei trockener Luft tiefer", () => {
    expect(wetBulb(5, 100)).toBeCloseTo(5, 0);
    expect(wetBulb(5, 50)).toBeLessThan(2);
  });
  it("Schneefallgrenze liegt unter der Nullgradgrenze", () => {
    const col = [lv(400, 4), lv(1000, 1), lv(1500, -2), lv(3000, -12)];
    const a = analyseColumn(col, 400);
    expect(a.freezing!).toBeGreaterThan(1100);
    expect(a.snowLine!).toBeLessThan(a.freezing!);
  });
  it("trockene Luft drückt die Schneefallgrenze weiter nach unten", () => {
    const wet = analyseColumn([lv(400, 4, 98), lv(1500, -2, 98), lv(3000, -12, 98)], 400);
    const dry = analyseColumn([lv(400, 4, 60), lv(1500, -2, 60), lv(3000, -12, 60)], 400);
    expect(dry.snowLine!).toBeLessThan(wet.snowLine!);
  });
  it("ganz kalte Säule: Schnee bis zum Boden", () => {
    expect(analyseColumn([lv(400, -3), lv(1500, -8)], 400).snowLine).toBe(400);
  });
  it("Warmschicht über Kaltluft wird als Inversion erkannt", () => {
    const a = analyseColumn([lv(400, -1), lv(900, 2), lv(1500, -3)], 400);
    expect(a.inversion).toBe(true);
    expect(a.freezing!).toBeGreaterThan(900);
  });
  it("Strecke Frauenfeld–Romanshorn ist rund 36 km lang", () => {
    const s = sampleRoute(PRESET_ROUTES[0]!.points);
    expect(s.at(-1)!.km).toBeGreaterThan(33);
    expect(s.at(-1)!.km).toBeLessThan(40);
  });
});
