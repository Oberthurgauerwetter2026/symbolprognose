import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUMS_REGION_BOUNDS } from "./sums-framing";

describe("full regional sum-map extent", () => {
  for (const [name, lat, lon] of [
    ["Amriswil", 47.546, 9.298],
    ["Romanshorn am Bodensee", 47.566, 9.378],
    ["Friedrichshafen am nördlichen Bodensee", 47.651, 9.479],
    ["Säntis", 47.249, 9.343],
  ] as const) {
    it(`includes ${name} for both rain and snow`, () => {
      assert.ok(lat >= SUMS_REGION_BOUNDS[0][0] && lat <= SUMS_REGION_BOUNDS[1][0]);
      assert.ok(lon >= SUMS_REGION_BOUNDS[0][1] && lon <= SUMS_REGION_BOUNDS[1][1]);
    });
  }
});