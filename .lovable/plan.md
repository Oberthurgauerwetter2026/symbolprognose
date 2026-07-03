
## Ursachenanalyse

Das weiße Aufflackern kommt nicht von einer einzelnen Stelle, sondern aus dem Zusammenspiel mehrerer Effekte in `src/components/maps/satellite-map.tsx`:

1. **Kompletter Layer-Remount bei jedem Refetch.**
   `MapContainer` enthält `<FrameStack key={\`${regionId}-${layer}-${frames.length}-${frames[0]?.time}\`} …>`. `useQuery` refetcht das Manifest alle 60 s. Sobald der älteste Frame aus dem Fenster fällt, ändert sich `frames[0]?.time` — der `key` wechselt, React unmountet den kompletten Stack, entfernt alle Leaflet-Layer und mountet sie neu. Für ein paar Frames ist gar keine Kachel auf dem Kartencontainer → der Karten-Hintergrund blitzt durch.

2. **Crossfade ohne Bereitschafts-Check des Ziel-Frames.**
   `setTimeMs(ms)` blendet `iPrev → iNext` linear (Smoothstep), ohne zu prüfen ob `iNext` schon Kacheln geladen hat. Solange `iNext` unfertig ist, wird `iPrev` proportional heruntergedimmt und die noch leere Zielebene zeigt den Kartenhintergrund → sichtbares Aufhellen/Flackern.

3. **Sichtbarer Layer wird zu früh auf 0 gesetzt.**
   Beim Anker-Wechsel zerot `lastPairRef`-Logik den alten `iPrev`, obwohl der neue `iNext` evtl. noch nicht geladen ist. Kombiniert mit (2) entsteht kurz ein „leeres" Bild.

4. **Karten-/Card-Hintergrund.**
   Der MapContainer ist `bg-black`, aber während des Layer-Remounts (Punkt 1) ist die gesamte Kartenfläche für wenige Frames ohne Tile-Layer — dann wirkt das Blitzen im hellen Card-Rahmen als weißer Blitz.

5. **Play-Loop schreibt bei jedem RAF `setUiIndex`.**
   Der Nearest-Frame-Vergleich erzeugt bei Anker-Übergängen einen React-Re-Render der ganzen Map-Komponente. Das ist zwar nicht direkt Flackern, verstärkt aber die Effekte 1–3, wenn Refetch und Render zusammenfallen.

## Ziel

Kein einziger weißer Blitz — weder bei Play, Scrub, noch bei periodischem Manifest-Refetch. Immer bleibt mindestens ein vollständig geladenes Satellitenbild sichtbar.

## Umsetzung

### 1. Stack ohne Full-Remount bei Refetch

- `FrameStack`-`key` nur noch auf `regionId` + `effectiveLayer` — nicht mehr auf `frames.length`/`frames[0].time`.
- Innerhalb von `FrameStack` Frame-Diff verwalten:
  - Neue Frames (per `time`-String identifiziert) inkrementell als WMS-Layer hinzufügen.
  - Aus dem Fenster gefallene Frames erst entfernen, wenn sie nicht Teil des aktuell sichtbaren Paars sind.
- `layersRef` wird zur `Map<timeIso, TileLayer>`; Nearest-/Prev/Next-Berechnung nutzt eine synchron mitgeführte sortierte `times[]`.
- Das eliminiert den 60-Sekunden-Flicker vollständig, weil kein einziger Layer mehr während Play remountet wird.

### 2. Bereitschafts-Gate für Crossfade

- Pro Layer `readyRef.current.has(index)` (gefüllt im `tl.on("load")`-Handler nach dem *ersten* vollständigen Load).
- `setTimeMs(ms)` erweitern:
  - Bestimme rohen `iPrev`/`iNext` wie heute.
  - **Wenn `iNext` noch nicht ready ist:** halte den zuletzt bekannten *ready* Nachbarn sichtbar (Opacity 1) und blende **nicht** herunter. Der Crossfade wird erst gestartet, sobald `iNext` fertig ist.
  - **Wenn `iPrev` nicht ready ist, aber `iNext` schon:** zeige `iNext` mit Opacity 1 (kein leerer Zustand).
  - Nur wenn *beide* ready sind, laufen die kontinuierlichen `1-alpha`/`alpha`.
- Alten `iPrev` erst auf 0 setzen, wenn der Nachfolger vollständig sichtbar (`alpha ≥ 1` bzw. Wechsel des Paars mit *beiden* ready).

### 3. Play-Loop gated durch Bereitschaft

- Der RAF-Loop schreibt weiter kontinuierlich `renderMsRef`. Aber:
  - Wenn `iNext` beim aktuellen `ms` nicht ready ist, wird die Zeit *nicht weiter erhöht* (Clamp auf `times[iPrev]` + kleiner Puffer), bis der Frame geladen ist.
  - Damit gibt es niemals einen sichtbaren Übergang zu einem unfertigen Frame.
- Fallback: falls ein Frame >5 s nicht lädt (Netzfehler), überspringen wir ihn und springen weiter — mit direktem Hard-Cut auf den nächsten *ready* Frame (kein Fade durch die Lücke), damit die Animation nicht hängt.

### 4. Lookahead-Preload

- Nach jedem Anker-Wechsel im Play-Loop stellen wir sicher, dass die nächsten 3 Frames bereits gemountet sind (bislang zeitverzögert per `setTimeout`). Mount-Sequenz priorisiert vorwärts (in Play-Richtung), sodass Kacheln früh im Cache liegen.
- Scrubbing löst zusätzlich einen sofortigen Priorisierungs-Boost für den Ziel-Frame und dessen Nachbarn aus (`mountFrame` synchron, ohne 40 ms-Timer).

### 5. Scrubbing verwendet exakt dieselbe Pipeline

- `handleScrubMs` bleibt der einzige Einstiegspunkt zur Zeitsetzung; er ruft `stackRef.current?.setTimeMs(ms)` genau so auf wie der Play-Loop. Damit ist das visuelle Ergebnis für einen gegebenen `ms`-Wert identisch, unabhängig von Play oder Drag.
- Beim Scrubben nutzen wir denselben Bereitschafts-Gate: die Bubble/Filmstrip-Position folgt dem Finger sofort, aber das *Bild* wechselt erst, wenn der Ziel-Frame ready ist (der aktuelle bleibt sichtbar). Kein leerer Zustand.

### 6. Karten-Hintergrund als zusätzliche Absicherung

- MapContainer bleibt `bg-black`; das ist bei Satellit visuell korrekt („kein Bild = Weltraum-Schwarz").
- Zusätzlich unter alle WMS-Layer eine dauerhaft montierte, sehr niedrig-aufgelöste „Fallback"-Ebene (statischer Layer auf dem *neuesten geladenen* Frame) legen. Wenn aus irgendeinem Grund oben alles auf 0 stünde, wäre trotzdem ein Bild zu sehen. (Umgesetzt einfach: der zuletzt vollständig gezeigte Frame wird nie unter Opacity 0 gedrückt, solange sein Nachfolger nicht ready ist — deckt sich mit (2), plus dedizierte `stickyRef` als letzter Fallback.)

### 7. React-Renders reduzieren

- `setUiIndex` im RAF-Loop nur noch schreiben, wenn (a) der Nearest-Index tatsächlich wechselt **und** (b) das seit dem letzten Update >150 ms her ist. Vermeidet Render-Storms an Anker-Grenzen.
- `loaded`-Counter aus dem `onProgress`-Callback throttled (max. alle 200 ms in einen `setLoaded`), damit die zig Load-Events kein Re-Render-Feuer auslösen.

## Validierung

- Playwright-Perf-Profil auf `/karten/satellit`:
  - RAF-Delta stabil < 20 ms während Play,
  - keine `MutationObserver`-Events auf Leaflet-Tile-Container außer bei echten Tile-Loads,
  - Screenshot-Serie über 90 s (Refetch-Grenze) — keine weißen Frames.
- Funktional:
  - Play über mindestens einen Manifest-Refetch hinweg ohne Flackern,
  - Scrubbing zeigt keinen leeren Zustand, auch nicht auf noch nicht geladene Frames,
  - Region-/Layer-Wechsel bleibt sauber (dort ist ein einmaliger Loader ok — Ladebalken ist bereits vorhanden),
  - TypeScript-Build grün.

## Betroffene Dateien

- `src/components/maps/satellite-map.tsx` (FrameStack-Diff-Mount, Ready-Gate, Play-Clamp, Preload, gedrosseltes `setUiIndex`/`setLoaded`).
