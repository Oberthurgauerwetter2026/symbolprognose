# Ursache

Die scharfe Kante stammt **nicht aus den MeteoSchweiz-Rohdaten**, sondern aus der PNG-Erzeugung in `scripts/ingest_radar.py` (`render_png`, Zeile 493-502):

- Pro Schwellwert (0.1, 0.3, 0.8, 2, 5, 15, 40, 80 mm/h) wird die Fläche in **eine** RGBA-Farbe gemalt.
- Dort, wo die echte Intensität knapp unter eine Schwelle fällt, bricht die Farbe schlagartig um → typische "Stufen-/Kantenartefakte" wie im Screenshot (helles Blau endet abrupt mitten im Niederschlagsgebiet).
- Ich habe das mit dem letzten R2-PNG (`/radar/precip/20260621T1830.png`, 240×144, 4× vergrößert) verifiziert: dieselbe Kante ist bereits im PNG sichtbar — also reines Rendering, kein Karten-Layering.

# Fix

Zwei sich ergänzende Schritte:

### 1. Glättung im PNG-Renderer (Python-Ingest)

In `scripts/ingest_radar.py`:

- Vor dem Schwellwert-Mapping ein **leichter Gauß-Filter** (`scipy.ndimage.gaussian_filter`, `sigma ≈ 0.6` Pixel) auf das `values`-Array (NaN-sicher: NaN→0, Filter, dann Maske zurücksetzen). Glättet Mikro-Rauschen, lässt Strukturen erhalten.
- Optional zusätzlich: pro Pixel **Alpha aus dem Abstand zur Schwelle ableiten**, damit Übergänge zwischen zwei Farbbändern weicher werden statt 0→255 zu springen. Konservativer Wert: 60-Prozent-Alpha-Ramp über die Hälfte des Bandabstands.

Schwellen, Farben und Bbox bleiben unverändert → Legende stimmt weiterhin.

### 2. CSS-Glättung im Frontend (sofort sichtbarer Effekt, ohne Re-Ingest)

In `src/components/maps/radar-map.tsx` (oder zentralem CSS für `.mch-precip`):

- `.mch-precip { image-rendering: auto; filter: blur(0.6px) contrast(1.05); }` — entfernt die letzte sichtbare Treppen-Kante beim Hochskalieren der 240×144-PNG auf Bildschirmauflösung.
- Nur für Messung-PNG (`.mch-precip`), nicht für den Prognose-Canvas.

# Verifikation

1. Nach dem Edit Worker-Trigger anstoßen → neues PNG in R2 → `/api/public/debug/r2-cache` zeigt frischen `latestPrecipTs`.
2. Karte `/karten/radar` öffnen, Slider auf "Messung" → die zuvor scharfe Kante sollte weich auslaufen.
3. Screenshot vorher/nachher vergleichen.

# Nicht-Ziele

- Keine Änderung an Farb-Schwellen oder Legende.
- Keine Änderung an Prognose-Frames (die rendern bereits über Canvas mit bilinearer Interpolation).
- Kein Smoothing über NaN-Lücken hinweg (Land/Meer-Maske bleibt scharf).
