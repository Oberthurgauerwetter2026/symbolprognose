import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { advancePlayback, playbackDuration, playbackSample } from "./radar-playback";

describe("radar playback at the default 2× speed", () => {
  const times = [0, 300_000, 1_200_000, 4_800_000];
  test("each regular step lasts 220 ms regardless of data cadence", () => {
    assert.equal(playbackDuration(0, 4, 1, 2), 220);
    assert.equal(playbackDuration(2, 4, 1, 2), 220);
    assert.equal(advancePlayback({ index: 0, elapsed: 0 }, 220, 4, 1, 2).index, 1);
  });
  test("transition occupies only the last 50 ms and labels stay snapped", () => {
    assert.equal(playbackSample({ index: 0, elapsed: 170 }, times, 1, 2).renderMs, 0);
    const halfway = playbackSample({ index: 0, elapsed: 195 }, times, 1, 2);
    assert.equal(halfway.renderMs, 150_000);
    assert.equal(halfway.blend, 0.5);
    assert.equal(halfway.frameMs, 0);
  });
  test("now holds for 700 ms", () => {
    assert.equal(advancePlayback({ index: 1, elapsed: 0 }, 699, 4, 1, 2).index, 1);
    assert.equal(advancePlayback({ index: 1, elapsed: 0 }, 700, 4, 1, 2).index, 2);
  });
  test("last image holds for 1000 ms then loops", () => {
    assert.equal(advancePlayback({ index: 3, elapsed: 0 }, 999, 4, 1, 2).index, 3);
    assert.deepEqual(advancePlayback({ index: 3, elapsed: 0 }, 1000, 4, 1, 2), { index: 0, elapsed: 0 });
  });
  test("a single image stays still", () => {
    assert.deepEqual(advancePlayback({ index: 0, elapsed: 0 }, 5000, 1, 0, 2), { index: 0, elapsed: 0 });
  });
});

// ===================== Zeitleiste =====================

const M = 60_000;
const at = (h: number, m: number) => Date.UTC(2026, 9, 1, h, m);
const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const every5 = (fromH: number, fromM: number, toH: number, toM: number) => {
  const out: string[] = [];
  for (let t = at(fromH, fromM); t <= at(toH, toM); t += 5 * M) out.push(new Date(t).toISOString());
  return out;
};

describe("buildTimelineSteps", () => {
  test("15-min-Modellbilder enden vor der nächsten vollen Stunde", () => {
    const frames = [
      ...every5(9, 0, 9, 40).map((t) => ({ t })),
      ...[45, 60, 75, 90, 105, 120, 180].map((min) => ({ t: new Date(at(9, 0) + min * M).toISOString() })),
    ];
    const steps = buildTimelineSteps(frames, at(9, 40));
    expect_no_quarter_after_hour(steps, at(10, 0));
    assert.deepEqual(steps.map(hhmm).slice(-5), ["09:40", "09:45", "10:00", "11:00", "12:00"]);
  });

  test("kurz vor der vollen Stunde gibt es keinen Viertelstundenschritt mehr", () => {
    const frames = [
      ...every5(9, 0, 9, 50).map((t) => ({ t })),
      ...[60, 75, 120, 180].map((min) => ({ t: new Date(at(9, 0) + min * M).toISOString() })),
    ];
    const steps = buildTimelineSteps(frames, at(9, 50));
    assert.deepEqual(steps.map(hhmm).slice(-3), ["09:50", "10:00", "11:00"]);
  });

  test("Nowcast-Schritte zählen als Brücke, danach Stundentakt", () => {
    const frames = [
      ...every5(9, 0, 9, 40).map((t) => ({ t })),
      ...[45, 50, 55].map((min) => ({ t: new Date(at(9, 0) + min * M).toISOString(), source: "nowcast" })),
      ...[60, 120, 180].map((min) => ({ t: new Date(at(9, 0) + min * M).toISOString() })),
    ];
    const steps = buildTimelineSteps(frames, at(9, 40));
    assert.deepEqual(steps.map(hhmm).slice(-5), ["09:45", "09:50", "09:55", "10:00", "11:00"]);
  });

  test("ohne Prognosebilder bleibt die Messzeit stehen", () => {
    const frames = every5(9, 0, 9, 30).map((t) => ({ t }));
    const steps = buildTimelineSteps(frames, at(9, 32));
    assert.deepEqual(steps.map(hhmm), ["09:00", "09:05", "09:10", "09:15", "09:20", "09:25", "09:30"]);
  });
});

function expect_no_quarter_after_hour(steps: number[], hour: number) {
  for (let i = 1; i < steps.length; i++) {
    if (steps[i] > hour) {
      const prev = steps[i - 1];
      assert.ok(prev % (15 * M) !== 0 || prev % (60 * M) === 0 || prev <= hour,
        `Schritt ${hhmm(prev)} liegt nach der vollen Stunde im Viertelstundentakt`);
      assert.ok(steps[i] % (60 * M) === 0, `Schritt ${hhmm(steps[i])} nach der vollen Stunde ist keine volle Stunde`);
    }
  }
}