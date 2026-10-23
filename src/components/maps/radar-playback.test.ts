/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { advancePlayback, playbackDuration, playbackSample } from "./radar-playback";

describe("radar playback at the default 2× speed", () => {
  const times = [0, 300_000, 1_200_000, 4_800_000];
  test("each regular step lasts 220 ms regardless of data cadence", () => {
    expect(playbackDuration(0, 4, 1, 2)).toBe(220);
    expect(playbackDuration(2, 4, 1, 2)).toBe(220);
    expect(advancePlayback({ index: 0, elapsed: 0 }, 220, 4, 1, 2).index).toBe(1);
  });
  test("transition occupies only the last 50 ms and labels stay snapped", () => {
    expect(playbackSample({ index: 0, elapsed: 170 }, times, 1, 2).renderMs).toBe(0);
    const halfway = playbackSample({ index: 0, elapsed: 195 }, times, 1, 2);
    expect(halfway.renderMs).toBe(150_000);
    expect(halfway.blend).toBe(0.5);
    expect(halfway.frameMs).toBe(0);
  });
  test("now holds for 700 ms", () => {
    expect(advancePlayback({ index: 1, elapsed: 0 }, 699, 4, 1, 2).index).toBe(1);
    expect(advancePlayback({ index: 1, elapsed: 0 }, 700, 4, 1, 2).index).toBe(2);
  });
  test("last image holds for 1000 ms then loops", () => {
    expect(advancePlayback({ index: 3, elapsed: 0 }, 999, 4, 1, 2).index).toBe(3);
    expect(advancePlayback({ index: 3, elapsed: 0 }, 1000, 4, 1, 2)).toEqual({ index: 0, elapsed: 0 });
  });
  test("a single image stays still", () => {
    expect(advancePlayback({ index: 0, elapsed: 0 }, 5000, 1, 0, 2)).toEqual({ index: 0, elapsed: 0 });
  });
});