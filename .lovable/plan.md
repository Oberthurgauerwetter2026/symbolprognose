# Radar-Prognose: flächiges Gelb absichern

## Befund (Stand jetzt geprüft)

- Das Prognose-Manifest (`radar/forecast-frames.json`) ist aktuell vollständig: 150 Frames, Coverage 100 %, davon 134 aus ICON-CH1 (15-min) und 16 aus der Stundenschiene.
- Die Prognose-PNGs in der Ablage sind aktuell plausibel: bei den geprüften Zeitpunkten sind 90–100 % der Fläche transparent, Gelb (5 mm/h) tritt nur in kleinen Kernen auf.
- Im lokalen Browsertest (Messung und Prognose bis Mi, 20:00) rendert die Karte weiche Bänder in der erwarteten Farbverteilung — kein flächiges Gelb.
- Die Skalierung stimmt: die 15-min-Werte werden korrekt mit 4 auf mm/h gebracht, die Stundenschiene kommt als mm/h direkt aus ICON-CH2 (kein Mehrfachmodell, keine 3-h-Summen).

Daraus folgt: Der Zustand aus dem Screenshot lässt sich mit den jetzt vorliegenden Daten nicht reproduzieren. Die Ursache ist damit **nicht bestätigt** — sie lag mit hoher Wahrscheinlichkeit in einem einzelnen Ingest-Lauf, dessen Feld für einige Stunden unrealistisch hohe Werte (≥ 5 mm/h über fast die ganze Fläche) enthielt. Deshalb steht am Anfang des Plans Beweissicherung plus eine Sperre, die so ein Bild gar nicht mehr anzeigt.

## Vorgehen

1. **Beweissicherung im Ingest**
   Beim Rendern jedes Prognose-Frames die Flächenanteile pro Farbband mitrechnen und in `radar/forecast-frames.json` pro Frame ablegen (z. B. `wetPct`, `maxBandPct`, `maxMmh`). Damit ist im Nachhinein belegbar, ob ein Frame flächig in einem hohen Band lag.

2. **Plausibilitätssperre im Ingest**
   Ein Frame wird nicht veröffentlicht, wenn ein hohes Band (≥ 5 mm/h) mehr als einen definierten Anteil der Fläche einnimmt (Startwert 25 %) oder wenn praktisch die gesamte Fläche nass ist (> 90 %). Statt eines unsinnigen Frames bleibt der bisherige (gute) Frame stehen; der Lauf protokolliert die Ablehnung.

3. **Zweite Sperre im Frontend**
   Beim Dekodieren eines Prognose-PNGs prüft die Karte denselben Anteil erneut. Reisst ein Frame die Schwelle, wird es nicht gezeichnet und der Zeitschritt bleibt leer — lieber keine Prognose als eine falsche Fläche.

4. **Sichtbarkeit im Admin**
   In der Pipeline-Diagnose je Prognoselauf anzeigen: Anzahl Frames, Coverage, abgelehnte Frames und den grössten Nassflächenanteil. So wird ein Rückfall sofort sichtbar, ohne auf einen Screenshot warten zu müssen.

5. **Merkregel festhalten**
   Die bestehende Regel „Prognose nie blockig“ wird um „Prognose nie flächig in einem hohen Band“ ergänzt, damit die Sperre bei künftigen Änderungen nicht wieder entfernt wird.

## Technische Details

- `scripts/ingest_openmeteo.py`: in `_render_frame_png` zusätzlich die Bandstatistik zurückgeben; in den beiden Frame-Schleifen (15-min und Stunden) die Schwellenprüfung einbauen, abgelehnte Stempel sammeln und in `FORECAST_STATS` melden; Manifest-Einträge um die Kennzahlen erweitern. Schwellen über ENV steuerbar (`FORECAST_MAX_HIGHBAND_PCT`, `FORECAST_MAX_WET_PCT`).
- `src/lib/radar.functions.ts`: die neuen Kennzahlen aus dem Manifest in den Frame-DTO übernehmen (ohne Verhaltensänderung an der bestehenden Filterlogik).
- `src/components/maps/radar-map.tsx`: im PNG-Decoder von `CrossfadePrecipOverlay` den Anteil hoher Bänder bestimmen und implausible Frames verwerfen.
- `src/lib/ingest-admin.functions.ts` + `src/routes/admin.tsx`: neue Kennzahlen in der Pipeline-Diagnose ausgeben.
- Keine Änderung an Datenquellen, Modellwahl oder Farbskala.

## Prüfung

- Ein künstlich flächig gesetztes Feld wird im Ingest abgelehnt (Log) und erscheint nicht im Manifest.
- Die aktuelle Prognose bleibt unverändert sichtbar (gleiche Frames, gleiche Optik).
- Admin zeigt Frames, Coverage und abgelehnte Frames des letzten Prognoselaufs.
