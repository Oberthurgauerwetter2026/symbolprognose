import { describe, expect, it } from "vitest";
import { sampleRadarBand } from "./forecast-edge-sampling";

describe("native forecast sampling", () => {
  const edge = new Float32Array([0, 1, 0, 1]);
  it("leaves measurement interpolation unchanged", () => {
    expect(sampleRadarBand(edge, 2, 2, 0.25, 0.5)).toBe(0.25);
    expect(sampleRadarBand(edge, 2, 2, 0.75, 0.5)).toBe(0.75);
  });
  it("never creates precipitation in a completely dry field", () => {
    expect(sampleRadarBand(new Float32Array(4), 2, 2, 0.5, 0.5, true)).toBe(0);
  });
  it("keeps uniform wet fields and strong cores unchanged", () => {
    expect(sampleRadarBand(new Float32Array([1, 1, 1, 1]), 2, 2, 0.5, 0.5, true)).toBe(1);
    expect(sampleRadarBand(new Float32Array([5, 5, 5, 5]), 2, 2, 0.5, 0.5, true)).toBe(5);
  });
  it("uses deterministic continuous subpixel sampling rather than block snapping", () => {
    const a = sampleRadarBand(edge, 2, 2, 0.5, 0.5, true);
    expect(a).toBe(sampleRadarBand(edge, 2, 2, 0.5, 0.5, true));
    expect(a).not.toBe(0.5);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    const b = sampleRadarBand(edge, 2, 2, 0.501, 0.5, true);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});