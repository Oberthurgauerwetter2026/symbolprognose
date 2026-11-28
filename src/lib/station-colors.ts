import type { ExtremeStat } from "@/lib/station-extremes";

// Gleiche Farbskala und Pillen wie die Live-Karte im Weather Hub.
const STOPS: [number, string][] = [[-30,"#0f1020"],[-27,"#13172f"],[-24,"#181e3f"],[-21,"#1c254e"],[-18,"#212c5e"],[-15,"#25336d"],[-12,"#2a3a7d"],[-9,"#2e418c"],[-6,"#33489c"],[-3,"#3a55b5"],[0,"#4169c9"],[3,"#3690d0"],[6,"#2f9dd0"],[9,"#3fbec2"],[12,"#44c47e"],[15,"#80ce62"],[18,"#bcd84a"],[21,"#f0dc3a"],[24,"#efc551"],[27,"#ed9a28"],[30,"#ea7826"],[33,"#e35a2a"],[36,"#d83a33"],[39,"#b82c2a"],[42,"#8e2020"]];
const h2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const GUST_STOPS: [number, string][] = [[0,"#44c47e"],[20,"#80ce62"],[40,"#f0dc3a"],[60,"#ed9a28"],[80,"#d83a33"],[100,"#8e2020"],[130,"#71369b"]];
// Beaufort-Skala (km/h) der Live-Karte im Weather Hub, für den aktuellen Wind.
const WIND_STOPS: [number, string][] = [[0,"#eef2f8"],[1,"#b8cee8"],[6,"#2f9dd0"],[12,"#3fbec2"],[20,"#44c47e"],[29,"#bcd84a"],[39,"#f0dc3a"],[50,"#ed9a28"],[62,"#ea7826"],[75,"#d83a33"],[89,"#a52020"],[103,"#7e1c1c"],[118,"#4a1010"],[140,"#2d0a0a"]];
const RAIN_STOPS: [number, string][] = [[0,"#e2e8f0"],[1,"#a9cfe9"],[5,"#3690d0"],[15,"#4169c9"],[30,"#33489c"],[60,"#71369b"],[100,"#b82c2a"]];
export function stationColor(v: number, stat: ExtremeStat): string {
  const stops = stat === "gust" ? GUST_STOPS : stat === "wind" ? WIND_STOPS : stat === "rain" || stat === "rainRate" ? RAIN_STOPS : STOPS;
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [av, ac] = stops[i], [bv, bc] = stops[i + 1];
    if (v <= bv) {
      const t = (v - av) / (bv - av), c = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
      return "#" + [1, 3, 5].map((o) => h2(c(ac, o) + (c(bc, o) - c(ac, o)) * t)).join("");
    }
  }
  return stops[stops.length - 1][1];
}
export const stationTextColor = (bg: string) => (0.299 * parseInt(bg.slice(1, 3), 16) + 0.587 * parseInt(bg.slice(3, 5), 16) + 0.114 * parseInt(bg.slice(5, 7), 16)) / 255 > 0.6 ? "#111827" : "#ffffff";
