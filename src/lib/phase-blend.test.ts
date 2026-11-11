import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blendPhaseRgb, phaseCore } from "./phase-blend";
const R: [number, number, number] = [0, 0, 255], S: [number, number, number] = [100, 100, 100], N: [number, number, number] = [200, 0, 200];
describe("blendPhaseRgb", () => {
  it("reine Phasen bleiben unverändert", () => {
    assert.deepEqual(blendPhaseRgb(0, R, S, N), R);
    assert.deepEqual(blendPhaseRgb(0.5, R, S, N), S);
    assert.deepEqual(blendPhaseRgb(1, R, S, N), N);
  });
  it("Übergang Regen→Schneeregen ist stufenlos", () => {
    const m = blendPhaseRgb(0.25, R, S, N);
    assert.deepEqual(m, [50, 50, 178]);
  });
  it("keine Symbole im Übergangsband", () => {
    assert.equal(phaseCore(0.25), null);
    assert.equal(phaseCore(0.95), 2);
  });
});
