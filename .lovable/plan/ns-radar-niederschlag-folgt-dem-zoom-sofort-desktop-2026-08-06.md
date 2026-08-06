# Ns-Radar: Niederschlag folgt dem Zoom sofort (Desktop)

## Beobachtung

Beim Reinzoomen mit Maus/Trackpad am Desktop bleibt das Niederschlagsbild kurz stehen bzw. springt erst nach dem Zoom auf die neue Grösse.

## Bestätigter Ist-Zustand

- Die Niederschlags-Overlays (Messung, Prognose-Crossfade, Zusatz-Overlay) zeichnen ausschliesslich auf `moveend zoomend resize` neu (`src/components/maps/radar-map.tsx`).
- Ein Zoom-Mitziehen existiert bereits (`src/components/maps/canvas-zoom-anim.ts`), reagiert aber nur auf `zoomanim` und auf `zoom` ohne laufende Animation.
- Beim `zoomstart` werden Render-Caches und Lookup-Tabellen geleert; nach dem Zoom muss das Bild komplett neu berechnet werden — daher der spürbare Nachzieheffekt.
- Die Karte nutzt `zoomSnap={0.5}` / `zoomDelta={0.5}`; wie viel davon aus Leaflets Wheel-Debounce (Sammeln der Wheel-Deltas vor dem Zoomschritt) stammt, ist noch nicht gemessen.

## Vorgehen

1. Messen: mit einer Browser-Session eine Wheel-Zoom-Sequenz auf `/karten/radar` fahren und protokollieren, wann `wheel`, `zoomstart`, `zoomanim`, `zoomend` und der Overlay-Redraw feuern. Damit ist klar, ob die Verzögerung vom Debounce, vom fehlenden Mitskalieren oder von der Neuberechnung kommt.
2. Zoom-Mitziehen lückenlos machen: das bestehende Canvas-Bild ab `zoomstart` bis `zoomend` durchgehend per CSS-Transform (Translate + Scale) auf den aktuellen Kartenzustand ziehen — auch für Wheel-Zoom-Schritte ohne saubere `zoomanim`-Animation. Ergebnis: das Niederschlagsbild wächst/schrumpft synchron mit den Kacheln, ohne Standbild.
3. Reaktion beschleunigen: Caches nicht mehr bei `zoomstart` verwerfen, sondern erst beim tatsächlichen Redraw nach `zoomend` (nur wenn sich der View-Key geändert hat), und den Redraw direkt im ersten Frame nach `zoomend` anstossen.
4. Wheel-Eingabe entschärfen, falls Schritt 1 den Debounce als Mitursache zeigt: Wheel-Sensitivität/Debounce der Karte so einstellen, dass der Zoom kontinuierlich statt in verzögerten Sprüngen läuft.
5. Nachmessen mit derselben Wheel-Sequenz und per Screenshots während der Animation prüfen, dass Kacheln und Niederschlagsbild deckungsgleich bleiben.

Farbskala, Interpolation, Crossfade und Zeitachse bleiben unverändert. Die gleiche Korrektur wird — falls sie greift — auch auf die Windkarte übertragen, weil sie dieselben Canvas-Layer nutzt.

## Technische Details

- `canvas-zoom-anim.ts` um einen Zustand für „Zoom läuft“ erweitern: `zoomstart` setzt ein Flag, `zoom`/`zoomanim` setzen `L.DomUtil.setTransform(canvas, offset, scale)` gegen den Zoomstand zu Beginn des Zooms, `zoomend` löscht das Flag und übergibt an den regulären Redraw-Pfad (`L.DomUtil.setPosition`).
- Offset/Scale weiterhin über `map.getZoomScale` und `_latLngToNewLayerPoint` (bzw. `latLngToLayerPoint` beim animationslosen Pfad) berechnen, damit der Punkt unter dem Cursor stehen bleibt.
- Cache-Invalidierung in den Overlays von `zoomstart movestart resize` auf View-Key-Vergleich im Redraw umstellen.
