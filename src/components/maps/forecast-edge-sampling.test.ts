import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { sampleRadarBand } from "./forecast-edge-sampling";

describe("native forecast sampling", () => {
  const edge = new Float32Array([0, 1, 0, 1]);
  it("leaves measurement interpolation unchanged", () => {
    assert.equal(sampleRadarBand(edge, 2, 2, 0.25, 0.5), 0.25);
    assert.equal(sampleRadarBand(edge, 2, 2, 0.75, 0.5), 0.75);
  });
  it("never creates precipitation in a completely dry field", () => {
    assert.equal(sampleRadarBand(new Float32Array(4), 2, 2, 0.5, 0.5, true), 0);
  });
  it("keeps uniform wet fields and strong cores unchanged", () => {
    assert.equal(sampleRadarBand(new Float32Array([1, 1, 1, 1]), 2, 2, 0.5, 0.5, true), 1);
    assert.equal(sampleRadarBand(new Float32Array([5, 5, 5, 5]), 2, 2, 0.5, 0.5, true), 5);
  });
  it("uses deterministic continuous subpixel sampling rather than block snapping", () => {
    const a = sampleRadarBand(edge, 2, 2, 0.5, 0.5, true);
    assert.equal(a, sampleRadarBand(edge, 2, 2, 0.5, 0.5, true));
    assert.notEqual(a, 0.5);
    assert.ok(a > 0 && a < 1);
    const b = sampleRadarBand(edge, 2, 2, 0.501, 0.5, true);
    assert.ok(Math.abs(a - b) < 0.01);
  });
});