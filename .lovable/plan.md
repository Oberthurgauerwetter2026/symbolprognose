# Satellitenbild: Blitze pro Zeitschritt animieren

## Ziel

Die Blitzpunkte sollen sich mit der Animation bewegen: In jedem Zeitschritt
erscheinen die Blitze, die in diesem Zeitfenster gefallen sind. Danach altern
sie mit den folgenden Frames farblich (hellgelb → orange → dunkelrot) und
verschwinden nach etwa 15 Minuten Blitz-Alter wieder.

## Ausgangslage (geprüft)

- `scripts/ingest_blitzortung.py` schreibt `lightning/latest.json` und behält
  dabei nur Blitze der letzten 15 Minuten (`BO_WINDOW_MIN = 15`, Zuhören ~90 s
  pro Lauf). Es gibt also keine Historie über die Animationsdauer.
- `LightningLayer` in `src/components/maps/satellite-map.tsx` zeichnet die Punkte
  gegen die aktuelle Uhrzeit (`Date.now()`) und aktualisiert im Sekundentakt —
  unabhängig vom angezeigten Zeitschritt.

## Änderungen

### 1. Rollierendes Blitz-Archiv (Backend)

- Der Ingest lädt vor dem Schreiben die bestehende Archivdatei
  `lightning/recent.json` aus R2, führt die neu empfangenen Blitze zusammen
  (Duplikate über Zeit/Position entfernen) und behält alle Blitze der letzten
  6 Stunden.
- `lightning/latest.json` bleibt unverändert bestehen (15-Minuten-Fenster), damit
  Radar-/Warnlogik und bestehende Anzeigen nicht brechen.
- Die Serverfunktion liefert zusätzlich das Archiv aus: erst `recent.json`,
  bei fehlender Datei Rückfall auf `latest.json`, dann leerer Payload.
- Das Archiv füllt sich ab dem nächsten Cron-Lauf auf; anfangs zeigen nur die
  jüngsten Zeitschritte Blitze.

### 2. Frame-genaue Anzeige (Karte)

- `LightningLayer` bekommt die Zeit des aktuell angezeigten Frames und
  berechnet das Alter jedes Blitzes gegenüber dieser Frame-Zeit, nicht gegenüber
  der Systemzeit.
- Blitze aus der Zukunft des Frames werden nicht gezeigt; Blitze älter als
  15 Minuten (bezogen auf die Frame-Zeit) verschwinden.
- Alterung wie bisher gestaffelt: 0–2 Min. hellgelb mit Glühen und grösserem
  Punkt, 2–8 Min. orange und kleiner werdend, 8–15 Min. dunkelrot und
  ausblendend bis zum Verschwinden.
- Der Sekunden-Timer entfällt; neu wird bei jedem Frame-Wechsel gezeichnet, was
  im Loop flüssiger ist und CPU spart.
- Der Hinweis „Keine aktiven Blitze“ gilt künftig für den angezeigten
  Zeitschritt.

## Technische Details

- `scripts/ingest_blitzortung.py`: Archiv-Merge (`ARCHIVE_MIN`, Default 360)
  plus Upload von `lightning/recent.json` (kurze Cache-Zeit wie bei
  `latest.json`).
- `src/lib/lightning.functions.ts`: Kandidatenliste um `lightning/recent.json`
  erweitern (vor `latest.json`), Payload-Validierung unverändert; Feld
  `windowMinutes` im Payload mitliefern.
- `src/components/maps/satellite-map.tsx`:
  - `LightningLayer({ strikes, frameTime })`, Alter = `frameTime - strikeTime`.
  - Aufruf mit `frames[safeIndex]?.time`.
  - Abfrage in `SatelliteMap`: `staleTime`/`refetchInterval` bleiben, Ergebnis
    ist jetzt das 6-h-Archiv.
