## Ziel
Die Niederschlagssummen-Karte (`/karten/niederschlag`) auf exakt denselben
meteorologischen Stack stellen wie Radar- und ICON-CH-Darstellung:
- gleiche Niederschlagsfelder (ICON-CH1 minutely_15 :00 → ICON-CH1 hourly →
  ICON-CH2 hourly, identisch zu `radar.functions.ts`),
- gleiche MeteoSchweiz-CombiPrecip-Farbpalette wie `radar-map.tsx`,
- konsistente Quellenangabe (kein „ICON-seamless" mehr).

Heute liest `precip-accum-map.tsx` zwar bereits die richtigen Frames
(`source === "icon-ch1" | "icon-ch2"` aus `RadarPayload`), nutzt aber eine
eigene, abweichende 10-Band-Palette mit zwei Zusatzklassen (dunkelblau,
dunkellila) und zeigt im Footer „ICON-seamless" an — das passt nicht zum
restlichen CH-Stack.

## Änderungen

### 1. `src/components/maps/precip-accum-map.tsx` — Palette auf MCH-Reset
`ACCUM_CLASSES` wird auf die acht Bänder der Radar-`SCALE` reduziert (gleiche
RGB-Tripel wie `radar-map.tsx` Z. 83–92). Die Schwellen bleiben in mm-Summe
und werden klar an die MeteoSchweiz-Tagessummen-Logik angelehnt — gleiche
Farbreihenfolge wie auf dem Radar, nur an Summen statt mm/h gehängt:

```ts
const ACCUM_CLASSES = [
  { min:  0.3, max:   1, rgb: [150, 195, 235], label: "0.3" }, // sehr leicht
  { min:  1,   max:   3, rgb: [ 95, 155, 220], label: "1"   },
  { min:  3,   max:  10, rgb: [ 40,  90, 195], label: "3"   },
  { min: 10,   max:  20, rgb: [ 55, 170,  75], label: "10"  }, // grün
  { min: 20,   max:  40, rgb: [245, 220,  55], label: "20"  }, // gelb
  { min: 40,   max:  60, rgb: [240, 140,  35], label: "40"  }, // orange
  { min: 60,   max: 100, rgb: [220,  40,  40], label: "60"  }, // rot
  { min:100,   max:9999, rgb: [170,  40, 180], label: "100+"}, // violett
];
```

→ identische Farbwahrnehmung über Radar-Animation, ICON-CH-Forecast-Frames
und Summen-Karte; gleiche „dark line/light line"-Konturlogik bleibt durch
den `ci <= 4`-Schwellwert (jetzt sauber in der Mitte der Skala) erhalten.

### 2. `src/components/maps/precip-accum-map.tsx` — Quellenangabe
TileLayer-Attribution (Z. 482):
```
attribution='Quelle: Oberthurgauer Wetter · © swisstopo · MeteoSchweiz ICON-CH1 → ICON-CH2'
```
(Analog zu `radar-map.tsx` / `wind-map.tsx`.)

### 3. `src/components/maps/precip-accum-map.tsx` — `accumulatePrecip` Kommentar
Kurze Kopfzeile ergänzen, damit klar ist, dass dieselben Frames wie in
`radar.functions.ts` aggregiert werden (ICON-CH1 minutely_15 :00 / CH1 hourly /
CH2 hourly, mm/h × Δh). Kein Code-Verhalten ändern — `frames` kommen schon
aus `getRadarFrames()` und tragen `source` & `values` (mm/h) konsistent.

### 4. Optional: Legende
Falls die Karte eine Legende rendert (zu prüfen in den restlichen Zeilen des
Files), die Labels an die neuen Schwellen anpassen (`0.3 / 1 / 3 / 10 / 20 /
40 / 60 / 100`).

## Was sich nicht ändert
- Datenpfad: weiterhin `getRadarFrames()` → `RadarPayload.frames`.
- Backend (`radar.functions.ts`, `ingest_openmeteo.py`).
- Heatmap-Rendering (bilineare Interpolation + harte Bänder + Blur) und
  Konturlogik.
- Routen, Embed, Andere Karten.

## Verifikation
- `/karten/niederschlag`: Farben der 12/24/48 h-Karten matchen visuell die
  Radar-Animation (gleiche Blau-/Grün-/Gelb-/Orange-/Rot-/Violett-Töne).
- Footer/Header: Quelle nennt „MeteoSchweiz ICON-CH1 → ICON-CH2", kein
  „ICON-seamless" mehr.
- Header-Zeile pro Karte zeigt unverändert `sourceMix` (z. B.
  „icon-ch1 + icon-ch2") aus den real verwendeten Frames.
