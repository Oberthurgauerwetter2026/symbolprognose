import { describe, it } from "node:test";
import assert from "node:assert/strict";
import switzerland from "../../data/switzerland.json";
import { SATELLITE_SWISS_BOUNDS, satelliteFitZoom } from "./satellite-framing";

describe("satellite framing", () => {
  it("contains the entire Swiss outline, including its western and eastern edges", () => {
    const geometry = switzerland.features[0]?.geometry;
    assert.equal(geometry?.type, "MultiPolygon");
    assert.ok(geometry);
    let points = 0;
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          assert.ok(lat >= SATELLITE_SWISS_BOUNDS[0][0] && lat <= SATELLITE_SWISS_BOUNDS[1][0]);
          assert.ok(lon >= SATELLITE_SWISS_BOUNDS[0][1] && lon <= SATELLITE_SWISS_BOUNDS[1][1]);
          points += 1;
        }
      }
    }
    assert.ok(points > 100);
  });

  it("fits a portrait phone without rounding upwards to the clipped zoom 7", () => {
    assert.equal(satelliteFitZoom(6.39, 7), 6.25);
    assert.equal(satelliteFitZoom(6.08, 7), 6);
    assert.equal(satelliteFitZoom(4.8, 7), 4.75);
  });

  it("retains the detailed regional zoom on a wide desktop", () => {
    assert.equal(satelliteFitZoom(8.25, 7), 7);
  });

  it("preserves integer fitting zooms for the Swiss loop", () => {
    assert.equal(satelliteFitZoom(7.8, 7, true), 7);
    assert.equal(satelliteFitZoom(10.25, 7, true), 9);
  });
});