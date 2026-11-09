import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createSumsCache } from "./sums-cache";

describe("sums refresh", () => {
  it("returns recent data immediately and registers a refresh", async () => {
    const get = createSumsCache<number>(30 * 60_000, 60 * 60_000);
    await get(async () => 1, 0);
    const tasks: Promise<unknown>[] = [];
    assert.equal(await get(async () => 2, 31 * 60_000, p => tasks.push(p)), 1);
    await Promise.all(tasks);
    assert.equal(await get(async () => 3, 32 * 60_000), 2);
  });
  it("never serves old data beyond one hour", async () => {
    const get = createSumsCache<number>(30 * 60_000, 60 * 60_000);
    await get(async () => 1, 0);
    assert.equal(await get(async () => 2, 61 * 60_000, () => {}), 2);
  });
  it("awaits refresh when no managed background lifetime exists", async () => {
    const get = createSumsCache<number>(30 * 60_000, 60 * 60_000);
    await get(async () => 1, 0);
    assert.equal(await get(async () => 2, 31 * 60_000), 2);
  });
});