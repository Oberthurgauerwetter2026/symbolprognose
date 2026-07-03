## Analyse

**Ursache des weißen Flackerns**
- Die Satellitenframes werden aktuell als viele separate Leaflet-WMS-TileLayer gemountet (`FrameStack`, `src/components/maps/satellite-map.tsx:101-389`).
- Neue Frames werden während der laufenden Karte als zusätzliche Leaflet-Layer/Tiles hinzugefügt (`tl.addTo(map)`, `satellite-map.tsx:327`). Dadurch entsteht DOM-/Tile-Churn im Leaflet-Tile-Pane.
- Die Sichtbarkeit wird pro Zeitposition über Layer-Opacity geregelt (`satellite-map.tsx:224-239`). Sobald ein Ziel-Layer formal als geladen gilt, kann er eingeblendet werden, obwohl einzelne Browser-Paints/Tile-Decodes noch nicht stabil sichtbar sind.
- Auf Region-/Layer-Wechsel wird der gesamte Frame-Stack entfernt (`satellite-map.tsx:126-144`). Das ist nicht der normale Framewechsel, aber es bestätigt, dass der aktuelle Ansatz Layer als austauschbare Leaflet-Objekte behandelt.
- Die Karte nutzt keinen Canvas/WebGL-Kontext; das Problem entsteht in der Leaflet-DOM-/Tile-Pipeline.

**Ursache der ruckelnden Animation**
- Die RAF-Schleife ist zwar vorhanden, aber sie hält die Zeit aktiv an, sobald `canAdvanceTo(next)` nicht beide Nachbarframes als ready meldet (`satellite-map.tsx:727-796`). Das verhindert weiße Lücken teilweise, erzeugt aber sichtbare Pausen und ungleichmäßige Geschwindigkeit.
- Autoplay startet bereits, wenn nur zwei Frames geladen sind (`ready = loaded >= Math.min(total, 2)`, `satellite-map.tsx:667` und `satellite-map.tsx:721-725`). Für eine komplette flüssige Schleife reicht das nicht.
- Das initiale Preloading priorisiert beim neuesten Frame direkt den Wrap zum ältesten Frame (`satellite-map.tsx:332-356`). Dadurch fehlen beim Abspielen oft die tatsächlich nächsten Zwischenframes.
- Bei Manifest-Updates wird die Renderzeit wieder auf einen diskreten Frame gesetzt (`satellite-map.tsx:698-712`). Das kann zusätzliche Sprünge verursachen.

## Plan zur dauerhaften Behebung

### 1. TileLayer-Frame-Stack durch stabile Double-Buffer-Bildpipeline ersetzen
- Den Satellitenraster nicht mehr als separaten Leaflet-WMS-TileLayer pro Frame darstellen.
- Stattdessen pro sichtbarem Kartenviewport direkte WMS-`GetMap`-Bilder laden: ein vollständiges Bild pro Satellitenzeit.
- Zwei persistente `<img>`-Buffer über der Leaflet-Karte halten:
  - Buffer A = vorheriger Frame
  - Buffer B = nächster Frame
- Die DOM-Elemente bleiben dauerhaft gemountet; nur `src`, `opacity` und Transform/Größe werden kontrolliert aktualisiert.
- Das aktuelle Bild bleibt immer sichtbar, bis beide für die Zielzeit benötigten Bilder vollständig geladen und per `decode()` renderbereit sind.

### 2. Echtes Preloading vor Autoplay
- Beim ersten Laden zunächst alle Frames des aktuellen Zeitfensters im Hintergrund laden und dekodieren, mindestens aber einen zusammenhängenden Play-Korridor vom aktuellen Zeitpunkt bis zum Loop-Ende.
- Autoplay erst aktivieren, wenn die für die Wiedergabe benötigten Frames renderbereit im Cache liegen.
- Während Manifest-Refetches alte Bilder im Cache behalten; neue Frames werden im Hintergrund ergänzt, ohne die sichtbare Animation zu resetten.

### 3. Eine gemeinsame kontinuierliche Timeline für Play und Scrubbing
- Eine zentrale Funktion `applyTimelineMs(ms)` steuert Karte und Filmstrip.
- Autoplay und manuelles Scrubbing rufen dieselbe Funktion auf.
- Die RAF-Schleife läuft konstant weiter und berechnet `t` kontinuierlich aus `dt`, statt an Tile-Readiness hängen zu bleiben.
- Wenn ein Zielbild beim Scrubbing noch nicht verfügbar ist, bleibt das letzte vollständig renderbare Bild sichtbar, während die Zielbilder priorisiert vorgeladen werden.

### 4. Kontinuierliche Wolkenbewegung per Crossfade-Interpolation
- Für jede Zeit `t` werden die beiden benachbarten Satellitenzeiten gesucht.
- `alpha` wird kontinuierlich aus der Position zwischen diesen Frames berechnet.
- Beide dekodierten Buffer werden mit `opacity = 1-alpha` und `opacity = alpha` überblendet.
- Dadurch entstehen keine harten Frame-Sprünge; die Bewegung wirkt wie ein ruhiger Film statt wie Einzelbilder.

### 5. React-Re-Renders aus dem Animationspfad entfernen
- Keine React-State-Updates pro Frame.
- Filmstrip, Zeitlabel und Bildopacities werden imperativ per Refs aktualisiert.
- `uiIndex`/Button-State nur stark gedrosselt aktualisieren oder aus der aktuellen Ref-Zeit ableiten.
- Manifest-Updates dürfen den Renderer nicht remounten und die aktuelle Zeit nicht auf diskrete Frames zurücksetzen.

### 6. Cache- und Qualitätsstrategie
- Bildcache keyed nach `layer + time + viewport + devicePixelRatio`.
- Bereits dekodierte Bilder wiederverwenden; identische URLs nicht erneut laden.
- HiDPI-Bilder über WMS-`WIDTH/HEIGHT` mit DPR-Skalierung anfordern, aber CSS-seitig stabil in die Karte einpassen.
- HRFI/hochwertige EUMETSAT-Layer beibehalten; keine automatische Qualitäts-Degradierung während Playback.

### 7. Sicherheitsnetz gegen helle Zwischenzustände
- Die vorhandene dunkle Leaflet-Hintergrundregel beibehalten.
- Zusätzlich die Bildbuffer selbst mit dunklem Hintergrund und `visibility`/`opacity` so steuern, dass nie ein leerer/weißer Kartenbereich sichtbar werden kann.

### 8. Verifikation und Dokumentation
- Nach Umsetzung per Live-Profil prüfen:
  - keine entfernten/neu gemounteten Frame-Layer während Playback,
  - keine neuen Bildrequests für bereits gecachte Zeiten,
  - stabile RAF-Frametimes,
  - kein sichtbarer weißer Hintergrund beim Play oder Scrubbing.
- Anschließend dokumentieren:
  - tatsächliche Ursache des Flackerns,
  - Ursache der Ruckler,
  - technische Änderungen, die beide Probleme beheben.