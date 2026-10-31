import { describe, it } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({ toBe: (e: unknown) => assert.equal(v, e), toBeNull: () => assert.equal(v, null) });
import { parseSmnCsv, stationWindowSum } from "./station-sums.ts";

const H = 3_600_000;

describe("station sums", () => {
  it("sums hourly precip in the window using interval end times", () => {
    const csv = "station_abbr;reference_timestamp;rre150h0;htoauths\n" +
      "GUT;31.10.2026 10:00;1.0;\nGUT;31.10.2026 11:00;2.5;\nGUT;31.10.2026 12:00;0.5;";
    const s = parseSmnCsv(csv, 60);
    expect(s[0].t).toBe(Date.UTC(2026, 9, 31, 11));
    const now = Date.UTC(2026, 9, 31, 13);
    expect(stationWindowSum(s, now, 2).rain).toBe(3);
  });

  it("returns null rain when more than 10% of the window is missing", () => {
    const now = Date.UTC(2026, 9, 31, 12);
    const s = [{ t: now, precip: 4, snowDepth: null }];
    expect(stationWindowSum(s, now, 12).rain).toBeNull();
  });

  it("counts only snow depth increases as new snow", () => {
    const now = 10 * H;
    const d = [0, 5, 12, 9, 15];
    const s = d.map((v, i) => ({ t: now - (d.length - 1 - i) * 2 * H, precip: 0, snowDepth: v }));
    expect(stationWindowSum(s, now, 12).snow).toBe(18);
  });
});
