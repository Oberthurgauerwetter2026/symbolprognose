## Ziel

Der Farb-Layer soll noch schärfere, sichtbarere Kanten zwischen Windstärke-Zonen bekommen. Aktuell (`STEP = 2`, `imageSmoothingEnabled = false`) ist die Pixel-Skalierung zwar hart, aber die Farbe selbst wird zwischen den Stufen der `WIND_SCALE` linear interpoliert (`windColor`). Dadurch entstehen weiche Farbverläufe ohne klare Grenzen.

## Änderung

Nur `src/components/maps/wind-map.tsx`, zwei kleine Stellen:

1. **Diskrete Farbstufen statt Verlauf** (Zeilen 45–62, `windColor`)
   - Lineare Interpolation entfernen. Statt zwischen zwei Stops zu mischen, gibt die Funktion direkt die Farbe des unteren Stops zurück (klassische "Bin"-Zuordnung wie bei Beaufort/Bft-Skalen).
   - Ergebnis: Sieben klar abgegrenzte Farbflächen → sichtbare Kanten zwischen 20/40/60/80/100/130 km/h.

2. **Feinere Pixelraster** (`WindColorOverlay`, Zeile 409)
   - `STEP` von `2` auf `1` senken. Damit wird pro CSS-Pixel gesampelt; die Farbgrenzen liegen exakt am Pixel statt am 2-Pixel-Block.
   - Performance: Auf einem ~1700 px Viewport sind das ~2 Mio Samples pro Redraw statt ~500 k. `WindColorOverlay` zeichnet nur bei `moveend/zoomend/resize` und bei Frame-Wechsel — kein per-Frame-Cost. Vertretbar.
   - `imageSmoothingEnabled = false` bleibt.

Optional (nicht im Plan, falls Performance bei STEP=1 spürbar wird, fallen wir auf STEP=2 zurück und behalten nur die diskreten Stufen).

## Auswirkung

Statt eines weichen Farbverlaufs zeigt der Layer klar abgegrenzte Bänder pro Windstärke-Stufe — visuell wie eine Bft-Karte. Die Kanten werden zur Schlüsselinformation, nicht mehr ein gleitender Übergang.