import { describe, it, expect } from "vitest";
import { blendPhaseRgb, phaseCore } from "./phase-blend";
const R: [number, number, number] = [0, 0, 255], S: [number, number, number] = [100, 100, 100], N: [number, number, number] = [200, 0, 200];
describe("blendPhaseRgb", () => {
  it("reine Phasen bleiben unverändert", () => {
    expect(blendPhaseRgb(0, R, S, N)).toEqual(R);
    expect(blendPhaseRgb(0.5, R, S, N)).toEqual(S);
    expect(blendPhaseRgb(1, R, S, N)).toEqual(N);
  });
  it("Übergang Regen→Schneeregen ist stufenlos", () => {
    const m = blendPhaseRgb(0.25, R, S, N);
    expect(m).toEqual([50, 50, 178]);
  });
  it("keine Symbole im Übergangsband", () => {
    expect(phaseCore(0.25)).toBeNull();
    expect(phaseCore(0.95)).toBe(2);
  });
});
