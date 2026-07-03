## Analyse aus Profil und Code

Die Ruckler entstehen sehr wahrscheinlich nicht durch den Filmstrip allein, sondern durch gekoppelte Hauptthread-Arbeit pro Animations-Tick:

1. **React rendert bei Play/Scrub zu oft**
   - Der Play-Loop setzt pro `requestAnimationFrame` React-State (`renderMs`, `playVisualMs`, teils `idx`).
   - Dadurch rendert `RadarMap` samt `FilmstripTimeline` und Overlay-Baum bei laufender Animation fortlaufend neu.

2. **Canvas wird pro Tick teuer neu berechnet**
   - `PrecipOverlay` zeichnet bei jedem `progress`-Update neu.
   - Dabei werden Canvas-Dimensionen neu gesetzt und für Zwischenzustände große Pixel-Arrays neu erzeugt.
   - Das ist genau die Arbeit, die beim Scrubbing/Play nicht synchron im Hauptthread entstehen darf.

3. **Filmstrip-Position hängt an React-State**
   - Die Strip-Translation und Bubble werden über React-Re-Renders aktualisiert.
   - Dadurch konkurrieren UI-Bewegung, Canvas-Interpolation und React-Reconciliation auf demselben Frame-Budget.

4. **Scrubbing triggert doppelte Arbeit**
   - Pointer-Move setzt sowohl Index/React-State als auch kontinuierliche Zeit.
   - Karte und Filmstrip sind zwar zeitlich gekoppelt, aber die Kopplung erfolgt über React statt über eine leichte, imperative Zeitquelle.

## Plan

### 1. Mini-Performance-Instrumentierung für die Korrektur einbauen
- Während der Umsetzung lokal mit einem Browser-Profil prüfen:
  - RAF-Deltas beim Play,
  - Long Tasks,
  - Anzahl React-/DOM-Updates,
  - Canvas-Neuberechnungen pro Sekunde.
- Die Messung dient nur zur Validierung; keine sichtbare Debug-UI im Produkt.

### 2. Eine imperative Timeline-Clock einführen
- `renderMs` bleibt als Datenmodell erhalten, wird aber nicht mehr bei jedem Frame als React-State geschrieben.
- Eine `renderMsRef`/Timeline-Clock steuert Play und Scrubbing direkt.
- React-State wird nur noch bei diskreten UI-Ereignissen aktualisiert:
  - Play/Pause,
  - Button-Schritt,
  - Scrub-Ende,
  - Wechsel des nächsten Viertelstunden-Ankers.

### 3. Filmstrip ohne React pro Frame bewegen
- `FilmstripTimeline` bekommt eine imperative API bzw. Refs für:
  - Strip-Transform,
  - Bubble-Text,
  - Bubble-Farbe,
  - ARIA-Wert nur gedrosselt.
- Während Play/Scrub wird `transform: translate3d(...)` direkt per RAF gesetzt.
- React rendert nur Struktur, Ticks und Controls; nicht jeden Animationsschritt.

### 4. Karte und Filmstrip über dieselbe Zeitquelle synchronisieren
- Play und Drag verwenden exakt dieselbe `setTimelineTime(ms)`-Funktion.
- Diese Funktion aktualisiert:
  - Filmstrip-Position sofort,
  - Overlay-Zeit sofort,
  - diskreten `idx` nur wenn der nächstgelegene Zeitanker wirklich wechselt.
- Damit bleibt der Übergang Messung → Prognose nahtlos, aber ohne React-Rerender pro Pixelbewegung.

### 5. Canvas-Rendering entlasten und cachen
- Canvas-Dimensionen nur ändern, wenn Viewport/DPR/Map-Größe sich tatsächlich ändern; nicht bei jedem Zeitupdate.
- Offscreen-Bilder für echte Frames weiter cachen.
- Zwischenzustände für Viertelstunden-Frames und häufige Play-Schritte vorwärmen bzw. in einem kleinen LRU-Cache halten.
- Beim Scrubbing werden vorbereitete Nachbarframes/blended Zustände genutzt; teure Pixel-Loops laufen nicht mehrfach für dieselbe Zeit/View.

### 6. Scrubbing glätten
- Pointer-Move schreibt nur in eine pending-Zeit und verarbeitet maximal einmal pro RAF.
- Keine harte Index-Snaps während des Drags.
- Beim Loslassen bleibt die aktuelle kontinuierliche Position erhalten; nur der UI-Anker wird nachgezogen.

### 7. Sichtbare Timeline virtualisieren/vereinfachen
- Die 15-Minuten-Prognose bleibt vollständig verfügbar.
- Der Filmstrip rendert aber nur sichtbare/nahe Ticks statt die komplette 48h-Tick-Struktur unnötig oft neu aufzubauen.
- Stundenlabels/Tageswechsel bleiben stabil, werden aber memoisiert und nicht bei jedem Animationsschritt neu berechnet.

### 8. Validierung
- Browser-Profil nach der Änderung:
  - keine regelmäßigen Long Tasks während Play/Scrub,
  - stabile RAF-Deltas,
  - deutlich weniger DOM-/React-Updates,
  - keine Canvas-Reallocation pro Frame.
- Funktional prüfen:
  - Play läuft flüssig über Messung → Prognose,
  - Scrubbing bleibt synchron und ohne Einrasten,
  - Prognose bleibt durchgehend im 15-Minuten-Raster,
  - TypeScript-Prüfung erfolgreich.