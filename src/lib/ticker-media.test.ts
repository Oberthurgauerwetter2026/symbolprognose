import { describe, expect, it } from "vitest";
import { checkVideo, isVideoPath, validVideoPath } from "./ticker-media";

describe("ticker videos", () => {
  it("accepts iPhone MOV up to 50 MB", () => expect(checkVideo("video/quicktime", 50_000_000)).toBe("mov"));
  it("rejects videos over 50 MB", () => expect(() => checkVideo("video/mp4", 50_000_001)).toThrow());
  it("rejects non-video types", () => expect(() => checkVideo("image/jpeg", 1000)).toThrow());
  it("only accepts own storage paths", () => {
    const ok = "einsendungen/2026-11-18/123e4567-e89b-12d3-a456-426614174000.mp4";
    expect(validVideoPath(ok, "einsendungen")).toBe(true);
    expect(validVideoPath(ok, "videos")).toBe(false);
    expect(validVideoPath("einsendungen/../x.mp4", "einsendungen")).toBe(false);
  });
  it("detects video paths", () => { expect(isVideoPath("a/b.mov")).toBe(true); expect(isVideoPath("a/b.jpg")).toBe(false); });
});
