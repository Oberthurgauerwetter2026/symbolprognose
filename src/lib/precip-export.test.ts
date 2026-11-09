import { describe, it, expect } from "vitest";
import { sumsToCsv } from "./precip-export";

const w = (v: number) => ({ 12: [v], 24: [v], 48: [v], 72: [v] });
const d = {
  gridLat: [47.5], gridLon: [9.3], rain: w(2), snow: w(-1), generatedAt: "2026-11-09T11:00:00Z", source: "", radar: null,
  stations: [{ id: "SAE", name: "Säntis", lat: 47.25, lon: 9.34, alt: 2501, rain: { 12: 1, 24: 2, 48: 3, 72: 4 }, snow: { 12: 5, 24: null, 48: 7, 72: 8 }, source: "mch" as const }],
  forecast: { rain: w(3), snow: w(0) },
} as never;

describe("sumsToCsv", () => {
  it("exports station new snow and leaves missing values empty", () => {
    const line = sumsToCsv(d).split("\n")[1].split(";");
    expect(line.slice(6, 10)).toEqual(["1", "5", "2", ""]);
  });
  it("exports missing model snow (-1) as empty, forecast values intact", () => {
    const line = sumsToCsv(d).split("\n")[2].split(";");
    expect(line[7]).toBe("");
    expect(line[14]).toBe("3");
  });
});
