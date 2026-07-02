## Plan

Ich werde den Übergang Messung → Prognose als eine echte zeitkontinuierliche Sequenz umsetzen, statt Animation, Scrubbing und Frame-Auswahl getrennt zu behandeln.

### 1. Einheitlichen Timeline-Sampler einführen
- Eine zentrale Funktion berechnet für jeden beliebigen Zeitpunkt `t` denselben Anzeigezustand.
- Dieser Sampler liefert:
  - aktuellen Render-Zeitpunkt,
  - bracketing Frames vor/nach `t`,
  - kontinuierlichen Fortschritt zwischen diesen Frames,
  - Modell-Framepaar für die Prognose-Fusion,
  - den nächstgelegenen Index nur noch für Buttons/Labels.
- Animation und Scrubbing nutzen danach exakt denselben Sampler.

### 2. Stop am Messung-Prognose-Seam entfernen
- Der Playhead läuft über die letzte Messung hinaus ohne Sonderfall oder Einrasten.
- Zwischen letzter Radar-Messung und erster Prognose wird nicht auf einen statischen Frame gewartet.
- Die letzte Messung wird nach `nowcast.nowMs` advektiv weitergeführt, bis die Modellprognose weich übernimmt.

### 3. Prognose-Fusion über den Seam korrekt berechnen
- Für die Fusion wird die letzte Radar-Messung nur als Nowcast-Basis verwendet.
- Die Modellseite der Fusion bekommt immer echte Prognose-Frames als `modelA/modelB` mit zeitlichem Fortschritt aus `t`.
- Dadurch bleibt die Bewegungsrichtung und Geschwindigkeit über den Übergang konsistent.

### 4. Scrubbing ohne Ruckeln
- Beim Ziehen wird kein hartes Frame-Snapping mehr für den visuellen Zustand verwendet.
- Der Slider gibt nur die kontinuierliche Zeit weiter; der Sampler berechnet daraus den identischen Zustand wie beim automatischen Abspielen.
- Der Index wird nur für UI-Buttons und Beschriftung synchronisiert, nicht als Render-Quelle für Zwischenzustände.

### 5. Filmstrip als durchgehende Sequenz darstellen
- Der Filmstrip bewegt sich mit konstanter Zeitgeschwindigkeit über Messung und Prognose hinweg.
- Sichtbare Unterbrechungen am Quellenwechsel werden entfernt.
- Optional vorhandene Messung/Prognose-Information bleibt intern, beeinflusst aber nicht mehr die Bewegung.

### 6. Validierung
- Auf `/karten/radar` prüfen:
  - automatisches Abspielen über den Übergang ohne Pause,
  - Scrubbing über den Übergang ohne Einrasten,
  - gleiche Regenzellen-Position bei identischem Zeitpunkt in Play und Scrub,
  - keine Richtungsumkehr oder Geschwindigkeitsänderung am Seam.
- Anschließend TypeScript-Prüfung ausführen.