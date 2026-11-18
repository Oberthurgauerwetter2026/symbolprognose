import { test, expect, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: new Map<string, { note: string | null }>(), radarReads: 0, denied: false }));
const rows = state.rows;
vi.mock("@/lib/warnings.server", () => ({
  adminClient: async () => ({
    from: () => ({
      select: () => ({ eq: (_column: string, job: string) => ({ maybeSingle: async () => ({ data: state.rows.get(job) ?? null, error: state.denied ? { message: "unavailable" } : null }) }) }),
      upsert: async (row: { job: string; note: string | null }) => {
        rows.set(row.job, { note: row.note });
        return { error: null };
      },
      delete: () => ({ eq: async (_column: string, job: string) => { rows.delete(job); return { error: null }; } }),
    }),
  }),
  setWarningRegions: async () => { throw new Error("must not change warnings while disabled"); },
}));
vi.mock("@/lib/openmeteo-cache.server", () => ({
  getRadarRegionMax: async () => { state.radarReads++; throw new Error("must not read radar while disabled"); },
}));

const { getAutoThunderEnabled, setAutoThunderEnabled } = await import("./auto-thunder-control.server");
const { runAutoThunder } = await import("./auto-thunder.server");

test("automatic warnings remain on until the admin changes the setting", async () => {
  rows.clear();
  expect(await getAutoThunderEnabled()).toBe(true);
});

test("off persists, blocks warning generation and push, and cannot be overwritten by run logs", async () => {
  rows.clear();
  state.radarReads = 0;
  await setAutoThunderEnabled(false);
  const result = await runAutoThunder();
  expect(result.created).toBe(0);
  expect(result.notified).toBe(0);
  expect(result.closed).toBe(0);
  expect(state.radarReads).toBe(0);
  expect(await getAutoThunderEnabled()).toBe(false);
  expect(rows.has("auto-thunder")).toBe(true);
});

test("switching back on persists and clears pre-pause confirmation candidates", async () => {
  rows.set("auto-thunder-candidates", { note: "old observations" });
  await setAutoThunderEnabled(true);
  expect(await getAutoThunderEnabled()).toBe(true);
  expect(rows.has("auto-thunder-candidates")).toBe(false);
});

test("unreadable settings fail closed instead of enabling automatic warnings", async () => {
  state.denied = true;
  await expect(getAutoThunderEnabled()).rejects.toThrow("unavailable");
  state.denied = false;
  rows.set("auto-thunder-settings", { note: '{"enabled":"false"}' });
  await expect(getAutoThunderEnabled()).rejects.toThrow("nicht lesbar");
});