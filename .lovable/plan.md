## Drei Punkte

### 1. Messung — Weichmachen reduzieren

Aktuell (`MeasurementCanvasOverlay`, redraw):

- `colorForSmooth(v)` (weiche Band-Interpolation)
- fbm-Warping `mod = 0.55 + n * 1.0` (sehr starke Modulation 0,55 …1,55×)
- `imageSmoothingEnabled = true` mit `quality: high`

Änderungen:

- **Warp-Amplitude halbieren**: `mod = 0.85 + n * 0.30` (Bereich 0,85 …1,15×). Konturen bleiben organisch, aber die NS-Form bleibt nah am Radarbild.
- **Domain-Frequenz reduzieren**: `sx = fx * 0.6 / sy = fy * 0.55` und Warp-Faktor `1.2` statt `2.6`. Längere Wellenlänge → keine "fransigen" Mini-Krümmungen, sondern grosszügige weiche Kanten.
- **Bilinear-Upsampling auf low statt high**: `imageSmoothingQuality = "low"` — vermeidet die zusätzliche Browser-Glättung, die das Bild "wattig" wirken lässt.
- Farbskala bleibt `colorForSmooth` (sonst kommen Quantisierungs-Unreinheiten zurück, das hat der User explizit moniert).

### 2. Erklärung zu ICON-CH1 `minutely_15`

ICON-CH1 liefert formal das Feld `minutely_15` — und ja, wir nutzen es bereits für die 15-min-Frames in den ersten 24 h. ABER: Open-Meteo zeigt für ICON-CH1 die Niederschlags-Intensität pro Stunde nur als **stündlich konstanten Wert**, der vier mal hintereinander im 15-min-Raster ausgeliefert wird:

```
17:15 5.1   17:30 5.1   17:45 5.1   18:00 5.1
```

Das ist eine Eigenheit der Open-Meteo-Auslieferung, nicht des Frontends — das Modell rechnet intern stündlich und repliziert die Werte ins 15-min-Schema. Deshalb erzeugen wir die sichtbare 15-min-Bewegung durch **räumliche Wind-Advektion** des Stundenfelds (jetzt 700 hPa, ADVECT_SCALE 1.0). Werte ändern sich nicht, die Felder ziehen aber zwischen den vollen Stunden über die Karte.

Keine Code-Änderung nötig, ausser der User wünscht, dass wir trotzdem die rohen 15-min-Werte ohne Advektion nehmen — dann sähen NS pro Stunde wieder identisch aus. Ja bitte die  rohen 15-min-Werte ohne Advektion nehmen. Für ein besseres "Ziehen" eine Möglichekit bieten

### 3. Filmstrip unter die Karte

Aktuell ist das Steuerungs-Panel (Play/Filmstrip/Settings) ein `absolute inset-x-2 bottom-2`-Overlay innerhalb des Map-Wrappers und deckt ~80 px Karte ab.

Änderung in `RadarMap` (`src/components/maps/radar-map.tsx`, JSX ab Line 1886):

- Steuerungs-Panel aus dem Map-Wrapper-Div herausziehen und als **Geschwister-Element** unterhalb des Map-Containers einfügen (das Parent hat bereits `space-y-3`).
- `absolute inset-x-2 bottom-2 z-[450]` → `relative w-full`. Panel selbst behält Rahmen/Hintergrund (`rounded-xl border bg-white shadow-sm`), aber ohne `backdrop-blur`/Transparenz (nicht mehr nötig).
- **Bare-Modus (Embed, `bare === true`)**: bleibt unverändert als Overlay — bei Embeds wäre extra Höhe unschön.
- Karten-Wrapper-Höhe unverändert: `h-[560px] sm:h-[600px]` — gewinnt jetzt vollständig sichtbare Karte zurück.

## Verifikation

- `/karten/radar`: Messung zeigt dezent organische Kanten ohne starke fbm-Wellen; keine Quantisierungs-Stippelung; Intensitätsverteilung bleibt erkennbar nah am Radar.
- Filmstrip + Play-Bar unter der Karte; Karte vollflächig sichtbar.
- Embed (`bare`) unverändert.
- Typecheck grün.