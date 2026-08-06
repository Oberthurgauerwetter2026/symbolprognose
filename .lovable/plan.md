# Radar: Niederschlag exakt mit der Karte zoomen

## Bestätigte Ursache

- Die Radar-Canvases erhalten während `zoomanim` bereits eine Ziel-Transformation.
- Anders als Leaflets Kartenkacheln, Bild-Layer und Vektor-Renderer tragen sie aber nicht die Klasse `leaflet-zoom-animated`.
- Leaflet bindet seine 250-ms-Zoomtransition ausschließlich an diese Klasse. Dadurch springt der Niederschlag sofort auf Zielgrösse/-position, während die Basiskarte noch animiert. Das erzeugt den sichtbaren Versatz und den Eindruck des verzögerten Nachziehens.
- Zusätzlich ist `zoomend` aktuell doppelt mit `redraw` verbunden: direkt in den Canvas-Layern und nochmals im gemeinsamen Zoom-Helfer.

## Umsetzung

1. Alle Radar- und Wind-Canvases über den gemeinsamen Zoom-Helfer als echte Leaflet-Zoom-Layer behandeln: `leaflet-zoom-animated` setzen und damit exakt dieselbe Transform-Dauer und Easing-Kurve wie die Basiskarte verwenden.
2. Die Zoom-Transformation an Leaflets eigenes Renderer-Muster angleichen: Referenzposition beim Start sichern, bei `zoomanim` nur Zieloffset und Zielskalierung setzen und bei `zoomend` einmal sauber neu zeichnen.
3. Den doppelten `zoomend`-Redraw entfernen, sodass nach der Animation nur ein gebündelter Neuaufbau erfolgt und kein zweiter Transform-Reset dazwischenfunkt.
4. Falls die Karte Zoomanimation deaktiviert, den bestehenden direkten `zoom`-Fallback ohne CSS-Transition beibehalten.
5. Im Browser mit mehreren Desktop-Wheel-Zoomschritten an verschiedenen Cursorpositionen prüfen: Niederschlag und Kartenkacheln müssen in Zwischenframes dieselbe Transform-Matrix besitzen und nach `zoomend` deckungsgleich bleiben.

## Umfang

Farben, Niederschlagsdaten, Filmstrip, Crossfade und Kartenfokus bleiben unverändert. Die Korrektur erfolgt im gemeinsamen Canvas-Zoom-Helfer und gilt dadurch konsistent für Radar und Wind.