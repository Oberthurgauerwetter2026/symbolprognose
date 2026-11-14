import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseStat, rankExtremes } from "./station-extremes";
import { productById } from "./ticker";

const rows = [
  { id: "a", name: "Amriswil", lat: 0, lon: 0, min: -2.5, max: -1.4 },
  { id: "b", name: "Uttwil", lat: 0, lon: 0, min: 2.1, max: 3.2 },
  { id: "c", name: "Opfershofen", lat: 0, lon: 0, min: -3.1, max: null },
];
describe("Stations-Extremwerte", () => {
  it("Min: kälteste Station zuerst", () => assert.deepEqual(rankExtremes(rows, "min").map((r) => r.name), ["Opfershofen", "Amriswil", "Uttwil"]));
  it("Max: wärmste zuerst, Station ohne Wert fällt weg", () => assert.deepEqual(rankExtremes(rows, "max").map((r) => r.name), ["Uttwil", "Amriswil"]));
  it("unbekannter Parameter fällt auf Min", () => assert.equal(parseStat("x"), "min"));
  it("Ticker bietet Tmin und Tmax als eigene Karten", () => {
    assert.equal(productById("temp-min")?.embed, "/embed/stationen-extrem?stat=min&clean=1");
    assert.equal(productById("temp-max")?.embed, "/embed/stationen-extrem?stat=max&clean=1");
  });
});
