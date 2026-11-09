import { it } from "node:test";
import { strict as assert } from "node:assert";
import { completeWindowSum } from "./sums-coverage";
const times = Array.from({ length: 12 }, (_, i) => (i + 1) * 3_600_000);
it("valid zero snowfall remains zero", () => assert.equal(completeWindowSum(times, times.map(() => 0), 0, 12, true), 0));
it("missing snowfall cannot become zero", () => assert.equal(completeWindowSum(times, times.map(() => null), 0, 12, true), -1));
it("partial snowfall cannot become a full-window amount", () => assert.equal(completeWindowSum(times, [null, ...times.slice(1).map(() => 1)], 0, 12, true), -1));
it("complete past snowfall sums all 12 hours", () => assert.equal(completeWindowSum(times, times.map(() => 1), 12 * 3_600_000, 12, false), 12));