/** Böen-Farbskala (km/h) – gemeinsam für Windkarte und Kachel-Standbild. */
export const WIND_SCALE: { v: number; rgb: [number, number, number]; label: string }[] = [
  { v: 0,   rgb: [ 60, 110, 190], label: "0"    },
  { v: 5,   rgb: [ 70, 145, 205], label: "5"    },
  { v: 10,  rgb: [ 80, 175, 200], label: "10"   },
  { v: 15,  rgb: [ 90, 195, 175], label: "15"   },
  { v: 20,  rgb: [110, 205, 140], label: "20"   },
  { v: 25,  rgb: [150, 215, 110], label: "25"   },
  { v: 30,  rgb: [200, 220,  90], label: "30"   },
  { v: 35,  rgb: [235, 215,  75], label: "35"   },
  { v: 40,  rgb: [245, 190,  65], label: "40"   },
  { v: 50,  rgb: [245, 155,  55], label: "50"   },
  { v: 60,  rgb: [240, 120,  55], label: "60"   },
  { v: 70,  rgb: [230,  80,  60], label: "70"   },
  { v: 80,  rgb: [200,  50,  85], label: "80"   },
  { v: 100, rgb: [150,  35, 135], label: "100+" },
];

export function windColor(kmh: number): [number, number, number] {
  // Diskrete Bänder mit schmalem weichen Übergang (±2 km/h) an den Grenzen.
  const HALF = 2;
  let i = 0;
  for (let k = WIND_SCALE.length - 1; k >= 0; k--) {
    if (kmh >= WIND_SCALE[k].v) { i = k; break; }
  }
  const cur = WIND_SCALE[i];
  const next = WIND_SCALE[i + 1];
  if (next && kmh >= next.v - HALF) {
    const t = Math.min(1, Math.max(0, (kmh - (next.v - HALF)) / (HALF * 2)));
    return [
      Math.round(cur.rgb[0] + (next.rgb[0] - cur.rgb[0]) * t),
      Math.round(cur.rgb[1] + (next.rgb[1] - cur.rgb[1]) * t),
      Math.round(cur.rgb[2] + (next.rgb[2] - cur.rgb[2]) * t),
    ];
  }
  return cur.rgb;
}
