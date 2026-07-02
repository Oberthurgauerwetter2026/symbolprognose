## Plan

### 1. Ursache gezielt beheben
- Die aktuelle Prognose enthält mehrere konkurrierende Bewegungsmodelle:
  - serverseitige Wind-Advektion für 15-Minuten-Frames,
  - clientseitige Shift-Schätzung mit Nowcast-Prior,
  - Nowcast/Modell-Fusion mit eigener Bewegung.
- Diese Pfade können unterschiedliche Richtungen liefern und erklären die „wilde“ Bewegung.
- Zusätzlich entsteht am Messung→Prognose-Seam ein sichtbarer Stopp, weil Anzeige-Frame, Filmstrip-Frame und kontinuierliche Renderzeit nicht konsequent aus derselben Timeline-Quelle berechnet werden.

### 2. Eine einzige kontinuierliche Timeline verwenden
- Einen zentralen Timeline-Sampler für jeden Zeitpunkt `t` verwenden.
- Play, Scrubbing, Filmstrip-Bubble und Karten-Overlay nutzen exakt diesen Sampler.
- Der Sampler liefert:
  - `renderMs`,
  - vorherigen/nächsten Frame,
  - kontinuierlichen Fortschritt `0…1`,
  - den nächsten UI-Index nur für Buttons/Labels.
- Kein Sonderfall, kein Einrasten und kein Stop bei letzter Messung / erster Prognose.

### 3. Server-Prognose von künstlicher Wind-Advektion befreien
- Die serverseitige 15-Minuten-Windverschiebung aus `radar.functions.ts` entfernen.
- Forecast-Frames bleiben echte Daten-Frames:
  - direkte Modell-Slots, falls vorhanden,
  - sonst die vorhandenen Stundenframes.
- Keine frei erzeugte Windbewegung, keine künstliche Eigenbewegung in den Daten.

### 4. Bewegungsmodell nur aus benachbarten Prognose-Frames berechnen
- In `PrecipOverlay` wird jeder Zwischenzustand ausschließlich aus Frame A und Frame B berechnet.
- Für A→B wird eine robuste globale Verschiebung aus genau diesen beiden Frames geschätzt.
- Keine Nowcast-Priors, keine Wind-Priors, keine zufälligen/noise-basierten Bewegungen.
- Wenn die Shift-Schätzung nicht eindeutig ist, wird nur die Intensität zwischen A und B interpoliert, statt eine unsichere Bewegung zu erfinden.
- Die Form bleibt möglichst erhalten durch symmetrisches Sampling:

```text
A wird Richtung B verschoben
B wird zurück Richtung A gesampelt
Intensität wird mit progress gemischt
```

### 5. Übergang Messung → Prognose nahtlos machen
- Die letzte Radar-Messung bleibt als reine Messung unverändert.
- Sobald die Zeit über die letzte Messung hinausläuft, rendert der Prognosepfad kontinuierlich weiter.
- Für den Seam wird die letzte Messung nur als Startzustand verwendet, danach übernimmt der normale A→B-Sampler.
- Keine Pause, kein Frame-Halten, kein Wechsel der Abspielgeschwindigkeit.

### 6. Filmstrip entkoppeln von harten Frame-Sprüngen
- Der Filmstrip bewegt sich kontinuierlich nach Zeit, nicht nach Frame-Index.
- Die sichtbaren Takte bleiben:
  - Messung: 5 Minuten,
  - Prognose bis 24 h: 15 Minuten,
  - danach: 60 Minuten.
- Beim Scrubben wird die Renderzeit kontinuierlich gesetzt; der Index wird nur noch für Prev/Next/Jetzt aktualisiert.

### 7. Performance sichern
- Pair-Shift pro Framepaar cachen.
- Offscreen-Canvas für Zwischenframes wiederverwenden.
- Prewarm nur für echte Datenframes behalten.
- Rendering weiterhin per Canvas, ohne zusätzliche gespeicherte Zwischenframes.

### 8. Validierung
- Auf `/karten/radar` prüfen:
  - Play über Messung→Prognose ohne sichtbaren Stop,
  - Scrubbing über den Seam ohne Pause oder Sprung,
  - Prognosebewegung folgt ruhig dem Verlauf der benachbarten Prognose-Frames,
  - keine Richtungsumkehr durch Nowcast-/Wind-Prior,
  - Radar-Messungsdarstellung bleibt unverändert.
- Danach TypeScript-Prüfung ausführen.