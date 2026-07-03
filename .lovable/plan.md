## Plan

### 1. Backend: 15-Minuten-Prognose über die gesamte Dauer erzeugen
- `getRadarFrames()` so ändern, dass Prognose-Frames bis zum Ende des 48h-Horizonts im 15-Minuten-Raster ausgegeben werden: `xx:00`, `xx:15`, `xx:30`, `xx:45`.
- Direkte `minutely_15`-Daten werden bevorzugt.
- Wenn nur Stundenwerte vorhanden sind, werden die Viertelstundenwerte aus den benachbarten Stundenframes berechnet, nicht kopiert.
- Die aktuelle zweite Phase mit nur stündlichen Frames nach +24h wird entfernt bzw. durch denselben 15-Minuten-Generator ersetzt.

### 2. Eine einzige Render-Zeit als Wahrheit verwenden
- Play, Scrubbing, Filmstrip-Bubble, aktuelle Frame-Auswahl und Karten-Overlay werden konsequent aus einer kontinuierlichen `renderMs`-Zeit berechnet.
- `idx` bleibt nur noch ein UI-/Button-Anker für Vor/Zurück/Jetzt, nicht die Quelle für den sichtbaren Radarzustand.
- Beim Loslassen des Scrubbings bleibt die zuletzt gewählte Zeit erhalten, statt auf einen Frame zu springen und dadurch einen sichtbaren Ruck zu erzeugen.

### 3. Übergang Messung → Prognose ohne Haltepunkt
- Der Übergang wird nicht mehr an `now` oder an einem Frame-Index geschnitten, sondern immer über das tatsächliche Frame-Paar berechnet: letzte Radar-Messung → erster Prognose-Frame.
- Der Sampler liefert für jede Zeit zwischen diesen beiden Frames einen Fortschritt `0…1`.
- Das Overlay rendert diesen Zwischenzustand direkt; kein Pausieren, kein Halten des letzten Messbilds, kein späteres Umschalten auf Prognose.

### 4. Bewegung nur aus benachbarten Prognose-Frames ableiten
- Zwischenzustände werden ausschließlich aus Frame A und Frame B berechnet.
- Keine zufälligen/noise-basierten Bewegungen, keine Wind-Advektion, keine Nowcast-Priors.
- Wo Stundenwerte die Grundlage sind, entstehen die Viertelstundenwerte serverseitig durch zeitliche Interpolation zwischen den echten Stundenfeldern.
- Clientseitig wird beim Play/Scrub zusätzlich kontinuierlich zwischen den benachbarten 15-Minuten-Frames interpoliert, damit auch Zeiten zwischen `xx:00/15/30/45` flüssig sind.

### 5. Filmstrip wirklich zeitbasiert machen
- Die Filmstrip-Skalierung bleibt linear nach Zeit.
- Die Prognose erhält sicht- und anwählbare 15-Minuten-Zeitpunkte für die gesamte Prognosedauer.
- Dragging sendet kontinuierliche Millisekunden an die Karte; Pfeiltasten und Buttons springen nur zu den definierten Viertelstundenmarken.

### 6. Performance und Stabilität
- Bestehende Canvas-Caches und Prewarm-Logik beibehalten, aber auf die neue 15-Minuten-Liste anwenden.
- Cache-Größe ggf. anpassen, damit 48h × 4 Frames performant bleiben.
- Keine Änderungen an Radar-PNG-Erzeugung, Farbskala, Karte oder Messdaten selbst.

### 7. Validierung
- Auf `/karten/radar` prüfen:
  - Play läuft über letzte Messung → erste Prognose ohne Stillstand.
  - Scrubbing über denselben Bereich zeigt sofort jeden Zwischenzustand.
  - Forecast enthält durchgehend Viertelstunden-Zeitpunkte bis zum Ende.
  - Zwischenstände sind berechnet, nicht kopiert.
  - Kein Sprung zurück auf Stundenframes nach +24h.
- Anschließend gezielte TypeScript-Prüfung ausführen.