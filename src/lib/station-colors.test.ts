import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rainSumColor, rainSumScale } from "./station-colors";

const rgb = (hex: string) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)) as [number, number, number];

describe("Farbe der Regensummen", () => {
  it("wenig Regen ist blau, viel Regen gelb bis rot", () => {
    const [lr, , lb] = rgb(rainSumColor(5)), [yr, yg, yb] = rgb(rainSumColor(40)), [rr, rg] = rgb(rainSumColor(80));
    assert.ok(lb > lr, "5 mm blau");
    assert.ok(yr > yb && yg > yb, "40 mm gelb");
    assert.ok(rr > 2 * rg, "80 mm rot");
  });
  it("Monats- und Jahressummen werden auf die Tagesskala gebracht", () => {
    assert.equal(rainSumScale(1), 1);
    assert.equal(rainSumScale(31), 4);
    assert.equal(rainSumColor(160, rainSumScale(31)), rainSumColor(40));
    assert.ok(rainSumScale(365) > 15 && rainSumScale(365) < 16);
  });
});
