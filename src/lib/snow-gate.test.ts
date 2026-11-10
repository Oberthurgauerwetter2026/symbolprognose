import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { gateSnowfall } from "./precip-past";
describe("gateSnowfall", () => {
  it("verwirft Schnee bei +4.5 °C im Flachland", () => {
    assert.deepEqual(gateSnowfall([2.17], [4.5], [960], 450), [0]);
  });
  it("verwirft Schnee bei Nullgradgrenze weit über Grund", () => {
    assert.deepEqual(gateSnowfall([1], [1], [1200], 450), [0]);
  });
  it("behält Schnee bei 0 °C und tiefer Nullgradgrenze", () => {
    assert.deepEqual(gateSnowfall([1.5], [0], [500], 450), [1.5]);
  });
});
