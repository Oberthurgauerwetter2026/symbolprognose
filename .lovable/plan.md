## Analyseergebnis

Ich habe die Satelliten-Pipeline in `src/components/maps/satellite-map.tsx` und `src/lib/satellite.functions.ts` geprüft. Die wahrscheinlichsten Ursachen für das weiße/helle Flackern und die weichere Bildqualität sind:

1. **Fallback-Wechsel entfernt den gesamten Layer-Stack**
   - In `satellite-map.tsx:181-185` löst bereits ein einzelner `tileerror` den Wechsel auf den Fallback-Layer aus.
   - Danach läuft der Effekt in `satellite-map.tsx:127-141` und entfernt alle bestehenden Leaflet-Layer.
   - Das ist genau der Zustand, der kurz eine leere Kartenfläche zeigen kann.
   - Im Live-DOM war sichtbar, dass aktuell `mtg_fd:rgb_geocolour` statt `mtg_hrfi:rgb_geocolour` angezeigt wird. Das erklärt zusätzlich die schlechtere Schärfe, weil die HRFI-Quelle verlassen wurde.

2. **Initiales Preloading lädt potenziell die falschen Frames zuerst**
   - `FrameStack` bekommt beim ersten Render oft `initialIsoRef.current` noch als `null` (`satellite-map.tsx:898`).
   - Dadurch wird die Priorisierung in `satellite-map.tsx:204-222` vom ersten/ältesten Frame aus aufgebaut, während die UI direkt zum neuesten Frame springt (`satellite-map.tsx:653-667`).
   - Ergebnis: Die sichtbare Zielzeit kann noch nicht vollständig geladen sein.

3. **Ready-Gate ist noch nicht paint-/decode-sicher**
   - `ready` wird beim Leaflet-`load` gesetzt (`satellite-map.tsx:171-179`). Das bedeutet: Netzwerk/Tiles fertig, aber nicht zwingend sicher dekodiert und stabil im nächsten Paint sichtbar.
   - Danach werden Opacities sofort geändert (`satellite-map.tsx:324-331`). In genau diesem Moment kann der Browser kurz den Kartenhintergrund zeigen.

4. **Kartenhintergrund fällt auf Leaflet-Standard zurück**
   - Obwohl `bg-black` gesetzt ist (`satellite-map.tsx:888`), war im Live-DOM der berechnete Kartenhintergrund `rgb(221, 221, 221)` — Leaflets heller Default-Hintergrund.
   - Wenn ein Layer kurz leer ist, sieht man daher ein helles/weißliches Aufblitzen.

5. **Autoplay startet zu früh**
   - `ready` wird bereits bei 50% geladener Frames gesetzt (`satellite-map.tsx:617-619`).
   - Für flüssige Animation reicht das nicht; relevant ist nicht die Gesamtquote, sondern ob aktueller Frame, nächster Frame und Lookahead vollständig bereit sind.

6. **Bildqualität geht durch Fallback, JPEG und fehlende HiDPI-Strategie verloren**
   - Gewünschte Hauptquelle ist HRFI: `mtg_hrfi:rgb_geocolour` (`satellite.functions.ts:36`, `49`).
   - Durch den automatischen Fallback wird aber offenbar `mtg_fd:rgb_geocolour` genutzt.
   - WMS wird aktuell als `image/jpeg` mit `tileSize: 512` angefordert (`satellite-map.tsx:151-155`). Auf HiDPI-Displays und bei verlustbehafteter JPEG-Ausgabe kann das weicher wirken.

## Plan zur Behebung

### 1. Layer-Wechsel flickerfrei machen
- Den automatischen Fallback bei einem einzelnen `tileerror` entfernen.
- Fallback nur noch verwenden, wenn eine versteckte Probe für den primären HRFI-Layer systematisch fehlschlägt.
- Beim Fallback niemals den sichtbaren Layer-Stack sofort entfernen: erst neuen Layer vollständig im Hintergrund laden, dann überblenden.

### 2. Echtes Double Buffering einführen
- Eine stabile sichtbare Ebene bleibt immer aktiv.
- Die nächste Ebene wird in einem unsichtbaren Back-Buffer geladen.
- Erst wenn alle sichtbaren Tiles geladen, dekodiert und mindestens einen Paint-Zyklus stabil sind, darf der Back-Buffer eingeblendet werden.
- Der alte Frame bleibt währenddessen bei voller Deckkraft sichtbar.
- Nach dem Crossfade wird der alte Layer als wiederverwendbarer Buffer behalten, nicht entfernt.

### 3. Decode-/Paint-sichere Readiness
- Die WMS-Tile-Erstellung so erweitern, dass nicht nur Leaflets `load`, sondern auch `HTMLImageElement.decode()` bzw. ein sicherer Fallback ausgewertet wird.
- Ein Frame gilt erst als renderbereit, wenn alle aktuell benötigten Tiles fertig geladen und dekodiert sind.
- Opacity-Wechsel erfolgen erst nach `requestAnimationFrame`, damit der Browser den neuen Frame garantiert gezeichnet hat.

### 4. Preloading priorisieren und begrenzen
- Beim Start zuerst den tatsächlich sichtbaren initialen Frame laden, nicht den ältesten Frame.
- Danach die nächsten 2–3 Frames in Wiedergaberichtung preloaden.
- Beim Scrubbing den Zielbereich priorisiert laden, aber bis dahin den nächsten bereits fertigen Frame sichtbar halten.
- Keine Massen-Mounts aller Frames gleichzeitig, um WMS-Requests, Cache-Churn und Tile-Errors zu reduzieren.

### 5. Kontinuierliche Timeline ohne sichtbare Leerstelle
- `requestAnimationFrame` bleibt die Zeitbasis.
- Die Zeit darf nur in Bereiche laufen, deren benötigte Frames renderbereit sind.
- Wenn ein Zielframe noch fehlt, bleibt die sichtbare Zeit am letzten fertigen Bild stehen; Filmstrip und Karte bleiben synchron.
- Kein Layer wird während Playback oder Scrubbing entfernt, solange er als sichtbarer oder letzter stabiler Frame gebraucht wird.

### 6. Leaflet-Hintergrund als Sicherheitsnetz korrigieren
- Eine Satelliten-spezifische Map-Klasse bekommt explizit einen dunklen Hintergrund auf `.leaflet-container`, `.leaflet-tile-pane` und relevante Panes.
- Das behebt nicht die Hauptursache, verhindert aber jedes helle Aufblitzen, falls ein externer Tile-Server kurz verzögert reagiert.

### 7. Maximale EUMETSAT-Bildqualität nutzen
- HRFI-Layer (`mtg_hrfi:*`) als bevorzugte Quelle beibehalten und nicht unnötig auf `mtg_fd:*` zurückfallen.
- Vor der finalen Änderung die WMS-Capabilities für verfügbare Formate und Layer prüfen.
- Wenn verfügbar, für GeoColour/IR auf verlustärmere Ausgabe wie `image/png` wechseln oder eine Qualitätsoption nutzen.
- HiDPI/Retina-fähige Tiles anfordern, damit auf Displays mit höherer Pixeldichte keine CSS-Hochskalierung sichtbar wird.
- Tile-Resampling nur browserseitig hochwertig lassen (`image-rendering: auto`) und keine künstliche Weichzeichnung/Skalierung einführen.

### 8. React-Remounts weiter reduzieren
- `FrameStack` stabil halten; keine `key`- oder Effekt-Änderung darf bei Manifest-Refetch den sichtbaren Stack entfernen.
- Manifest-Updates sollen die bestehende Wiedergabezeit erhalten, statt die Animation auf einen diskreten Frame zurückzusetzen.
- UI-State bleibt gedrosselt; die Karte wird weiterhin imperativ über die RAF-Pipeline gesteuert.

## Erfolgskriterium nach Umsetzung

- Während Playback und Scrubbing ist immer mindestens ein vollständig geladenes Satellitenbild sichtbar.
- Keine helle/weiße Kartenfläche erscheint zwischen zwei Frames.
- HRFI bleibt die primäre Datenquelle; Fallback wird nur kontrolliert und flickerfrei genutzt.
- Wolkenstrukturen wirken schärfer, besonders auf HiDPI-Displays und bei höheren Zoomstufen.
- Die Animation bleibt kontinuierlich, ohne framebasiertes Springen oder sichtbares Neuladen.