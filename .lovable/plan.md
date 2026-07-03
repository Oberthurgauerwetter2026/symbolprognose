
## Ziel

Satelliten-Zeitraffer läuft so flüssig wie SAT24: kontinuierliche Zeit `t` (RAF, nicht framebasiert), weiche Übergänge zwischen den EUMETSAT-WMS-Frames, absolut ruckelfreies Scrubbing, gleicher Look-and-Feel-Filmstrip wie beim Niederschlagsradar.

## Aktueller Zustand (Kurzanalyse)

`src/components/maps/satellite-map.tsx`:
- `setInterval(setIndex, speedMs)` — framebasierter Sprung von Bild zu Bild, harte Kanten zwischen Frames.
- Aktiver Frame wird über `opacity: 0/1` umgeschaltet — keine Interpolation.
- Scrubbing setzt `index` per React-State pro Pointer-Move (RAF-throttled, aber trotzdem React-Re-Render pro Bewegung).
- Filmstrip ist eine eigene, vom Radar abweichende Implementierung (`SatelliteTimeline`) — nicht die gewünschte gemeinsame Komponente.

## Umsetzung

### 1. Gemeinsamen Filmstrip extrahieren

- Die Filmstrip-Komponente aus `radar-map.tsx` (inkl. Bubble, Stundenticks, Tages-Segmente, imperativer RAF-Position, Scrub-Logik) in ein eigenes Modul `src/components/maps/timeline-filmstrip.tsx` heben.
- Radar-Map und Satelliten-Map konsumieren beide dieselbe Komponente. Props: `tMin`, `tMax`, `getBubbleLabel(ms)`, `onScrub(ms)`, `onScrubEnd(ms)`, `clockRef` (für imperatives Update von Handle-Position + Bubble ohne React-Re-Render).
- Kein visueller Unterschied zum bisherigen Radar-Strip.

### 2. Kontinuierliche Zeitachse für Satellit

- `renderMsRef` als Single Source of Truth für die aktuelle Zeit; kein `index`-State pro Frame mehr.
- Play-Loop per `requestAnimationFrame`: `renderMs += dt * speed`; wrap am Ende zurück auf `tMin`. Speed-Auswahl (0.5×/1×/2×/4×) bleibt.
- Bei jedem RAF-Tick:
  - Filmstrip-Handle imperativ aktualisieren (Transform + Bubble-Text via Ref).
  - Overlay-Interpolation (siehe §3) imperativ aktualisieren.
  - React-State wird nur bei Play/Pause, Speed-Change und Region-Wechsel gesetzt.

### 3. Cross-Fade-Interpolation zwischen WMS-Frames

- Alle Frames wie bisher als `L.tileLayer.wms` gemountet (`FrameStack`), aber Opacity nicht 0/1 sondern kontinuierlich:
  - Für aktuelles `t`: finde `iPrev`, `iNext` mit `times[iPrev] ≤ t < times[iNext]`.
  - `alpha = (t - times[iPrev]) / (times[iNext] - times[iPrev])`.
  - `layers[iPrev].setOpacity(1 - alpha)`, `layers[iNext].setOpacity(alpha)`, alle anderen `0`.
  - Sanftes ease (smoothstep) auf `alpha` gegen Flackern.
- Nur mounten was tatsächlich benötigt/nachbar-nah ist bleibt wie heute (radial prewarm).
- Beim Region-/Layer-Wechsel Übergang deaktivieren bis Nachbarn geladen sind, um Flackern zu vermeiden.

Hinweis: echte Optical-Flow-Warping-Wolken sind auf WMS-Tiles im Browser nicht praktikabel (kein Pixelzugriff, CORS/Tile-Grid). Cross-Fade mit kontinuierlichem Alpha ist der SAT24-übliche Ansatz für WMS-Layer und liefert die gewünschte „ruhige Wolkenbewegung".

### 4. Scrubbing

- Pointer-Move schreibt nur in `pendingMsRef`; ein einziger RAF pro Frame verarbeitet den letzten Wert.
- Setzt `renderMsRef`, aktualisiert Overlay-Alpha und Handle imperativ — kein React-Render.
- Kein Snap auf diskrete Frames während des Drags; erst am `pointerup` wird `lastTimeRef` auf den nächsten realen Frame gesetzt (für Refetch-Persistenz).

### 5. Filmstrip-Performance

- Stundenticks / Tages-Segmente memoisiert auf `[tMin, tMax]`.
- Nur sichtbare Ticks rendern (die Satelliten-Zeitachse ist mit 3–5 h ohnehin klein — hier reicht Memoisierung, keine Virtualisierung nötig).
- ARIA-Wert throttled (max. alle 200 ms) aktualisieren.

### 6. Validierung

- Playwright-Perf-Profil auf `/karten/satellit`:
  - stabile RAF-Deltas während Play und Scrub (< 20 ms),
  - keine regelmäßigen Long Tasks,
  - React-Re-Renders nur bei Play/Pause/Speed/Region.
- Funktional:
  - kontinuierlicher, ruckelfreier Play über den gesamten Zeitraum,
  - Scrubbing synchron, ohne Sprünge zwischen Frames,
  - identisches Filmstrip-Verhalten wie im Radar,
  - Region-Wechsel ohne Flackern,
  - TypeScript-Build grün.

## Betroffene Dateien

- neu: `src/components/maps/timeline-filmstrip.tsx` (gemeinsame Filmstrip-Komponente + Clock-Ref-API)
- `src/components/maps/radar-map.tsx` (auf gemeinsame Filmstrip-Komponente umstellen, Verhalten unverändert)
- `src/components/maps/satellite-map.tsx` (kontinuierliche Zeitachse, RAF-Loop, Cross-Fade-Overlay, gemeinsamer Filmstrip)
