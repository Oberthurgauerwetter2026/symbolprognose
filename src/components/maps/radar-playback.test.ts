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