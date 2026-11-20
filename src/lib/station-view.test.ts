import { describe, expect, it } from "vitest";
import { buildStationView, compass, stationSlug, windChill } from "./station-view";

describe("station view", () => {
  it("Windrichtung 276° ist W", () => expect(compass(276)).toBe("W"));
  it("Windchill erst ab Wind über 4.8 km/h", () => {
    expect(windChill(5, 3)).toBe(5);
    expect(windChill(5, 20)!).toBeLessThan(5);
  });
  it("Slug ohne Umlaute", () => expect(stationSlug("Opfershofen")).toBe("opfershofen"));
  it("Böe in km/h und Tagesmaximum nur von heute", () => {
    const now = Date.parse("2026-11-20T15:00:00Z");
    const base = { dew_point: 1, humidity: 80, pressure: 1005, rain_rate: 0, wind_speed: 1, wind_dir: 0 };
    const v = buildStationView("X", [
      { ...base, measured_at: "2026-11-19T12:00:00Z", temperature: 20, wind_gust: 20 },
      { ...base, measured_at: "2026-11-20T14:50:00Z", temperature: 10, wind_gust: 10 },
    ], { today: 0.4, yesterday: 2 }, now);
    expect(v.today.tMax?.v).toBe(10);
    expect(v.yesterday.tMax?.v).toBe(20);
    expect(v.today.gust?.v).toBe(36);
    expect(v.stale).toBe(false);
  });
});
