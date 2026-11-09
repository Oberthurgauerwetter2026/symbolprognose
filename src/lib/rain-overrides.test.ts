import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { applyDailyOverrides } from "./rain-overrides";

const t0 = Date.parse("2026-11-09T10:00:00Z");
const s = (t: number, p: number | null) => ({ t, precip: p, snowDepth: null, dur: 600_000 });

describe("applyDailyOverrides", () => {
  it("skaliert die Werte eines Tages auf die manuelle Tagessumme", () => {
    const out = applyDailyOverrides([s(t0, 1), s(t0 + 600_000, 3)], [{ day: "2026-11-09", rain_sum: 8 }]);
    assert.deepEqual(out.map((x) => x.precip), [2, 6]);
  });
  it("verteilt die Summe gleichmässig, wenn kein Regen gemessen wurde", () => {
    const out = applyDailyOverrides([s(t0, 0), s(t0 + 600_000, 0)], [{ day: "2026-11-09", rain_sum: 4 }]);
    assert.deepEqual(out.map((x) => x.precip), [2, 2]);
  });
  it("lässt andere Tage unverändert", () => {
    const out = applyDailyOverrides([s(t0, 1)], [{ day: "2026-11-08", rain_sum: 9 }]);
    assert.equal(out[0].precip, 1);
  });
});
