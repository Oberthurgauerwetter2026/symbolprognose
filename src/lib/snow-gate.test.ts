import { describe, it, expect } from "vitest";
import { gateSnowfall } from "./precip-past";
describe("gateSnowfall", () => {
  it("verwirft Schnee bei +4.5 °C im Flachland", () => {
    expect(gateSnowfall([2.17], [4.5], [960], 450)).toEqual([0]);
  });
  it("verwirft Schnee bei Nullgradgrenze weit über Grund", () => {
    expect(gateSnowfall([1], [1], [1200], 450)).toEqual([0]);
  });
  it("behält Schnee bei 0 °C und tiefer Nullgradgrenze", () => {
    expect(gateSnowfall([1.5], [0], [500], 450)).toEqual([1.5]);
  });
});
