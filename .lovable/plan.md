Ich werde die Abspiel-Logik gezielt stabilisieren, ohne Scrubbing oder die bestehenden Layer-Optionen umzubauen.

1. Radar-Play deterministisch machen
- Die Animation wird nicht mehr über `find(i > cur)` und Index-Snapping im laufenden Effect gesteuert.
- Stattdessen bekommt Play eine feste Step-Position innerhalb der vorberechneten Zeitleiste.
- Pro Tick wird höchstens ein Schritt weitergeschaltet; keine doppelten State-Updates, kein Rücksprung auf den Anfang während einer normalen Sequenz.
- Der Fortschritt zwischen zwei Frames bleibt sauber bei `0…1` und wird beim Schrittwechsel kontrolliert zurückgesetzt.

2. Radar-Takt beibehalten
- Messung: 5 Minuten.
- Prognose erste 24 Stunden: 15 Minuten.
- Prognose danach: 1 Stunde.
- Scrubbing bleibt weiterhin fein über alle vorhandenen Frames möglich.

3. Wind-Play auf echte 1-Stunden-Schritte bringen
- Die Windanimation bekommt ebenfalls eine eigene Play-Step-Zeitleiste.
- Beim Abspielen wird stündlich weitergeschaltet, auch wenn die Rohdaten teilweise gröbere Abstände enthalten.
- Fehlende Zwischenstunden werden für die Animation aus den umliegenden Windframes interpoliert: Böen und Windgeschwindigkeit linear, Windrichtung winkelkorrekt.
- Timeline/Scrubbing bleiben unverändert an den geladenen Frames orientiert.

4. Flüssigkeit und Stabilität vereinheitlichen
- Radar und Wind verwenden dieselbe robuste Play-Mechanik: Refs für laufenden Fortschritt, stabile Step-Position, sauberer `requestAnimationFrame`-Loop.
- `nextFrame` wird aus derselben Step-Logik abgeleitet wie der sichtbare aktuelle Frame, damit Overlay, Label und Animation nicht auseinanderlaufen.

5. Prüfung
- Radar Play starten und prüfen, dass Zeitlabel und Layer gleichmäßig vorwärtslaufen.
- Übergänge Messung → 15-min-Prognose → 1-h-Prognose prüfen.
- Wind Play starten und prüfen, dass die Zeit im 1-Stunden-Takt läuft statt 2 Stunden zu springen.