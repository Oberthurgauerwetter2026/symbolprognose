# MCH-Messung: Snap-Frames + korrekte ODIM-Zeit

Zwei eigenständige Bugs im bestehenden Projekt fixen. Kein zweites Projekt nötig — Messung und Prognose koexistieren problemlos, nur die Render- und Ingest-Logik ist falsch konfiguriert.

## Was geändert wird

### 1. Messung schaltet hart um (Snap), kein Crossfade mehr
In `src/components/maps/radar-map.tsx`:
- Den PNG-Crossfade entfernen. Aktuell werden für MCH-PNGs zwei `ImageOverlay`-Layer übereinander gerendert (`currentFrame` mit absteigender Opacity, `blendNextPng` mit aufsteigender Opacity, gesteuert von `progress` 0…1). Das erzeugt den „in die Länge gezogen statt verlagert"-Eindruck, weil zwei statische Bilder einfach ineinander faden — Zellen scheinen am Ort zu wachsen/schrumpfen.
- Neue Logik: Wenn `currentFrame.precipUrl` existiert (= Messung), wird nur **ein** `ImageOverlay` mit voller `opacity` (0.95) gerendert. `blendNextPng` und der zugehörige zweite Overlay entfallen komplett.
- Der Canvas-Pfad für Forecast-Frames bleibt unverändert (dort ist Wert-Interpolation sinnvoll, weil ICON-Frames 15 min auseinander liegen und glatte Felder haben).

Effekt: Jeder Mess-Frame wird für die volle `FRAME_MS`-Dauer (750 ms / speed) scharf gezeigt und springt dann hart auf den nächsten. Konvektion wandert sichtbar, statt zu pulsieren.

### 2. ODIM `enddate/endtime` wird verbindliche Frame-Zeit
In `scripts/ingest_radar.py`:
- Aktuell ist der STAC-Dateiname primäre Zeitquelle; die H5-Zeit (`image_time` aus `enddate/endtime`) wird nur übernommen, wenn sie ≤10 min vom Filename abweicht (Zeile 560–573 in `process_asset`).
- Umkehren: Wenn `image_time` aus dem H5 vorhanden ist, **immer** diese verwenden — das ist die physikalisch korrekte Zeit (Ende des 5-min-Akkumulations-Intervalls = nominaler Bildzeitpunkt). Der STAC-Filename ist nur noch Fallback, falls `image_time` fehlt.
- Das löst die „Uhrzeit stimmt nie"-Beobachtung: bisher zeigte das UI die Filename-Minute, der Bildinhalt gehörte aber zu einer anderen Minute.

### 3. Version bumpen → automatischer Purge
`RADAR_INGEST_VERSION` in `scripts/ingest_radar.py` von `v19-mch-intensity-boost` auf `v20-odim-time` setzen. Die bestehende Versions-Migration in `main()` (Zeile 677–690) löscht dann alle alten PNGs in R2, die noch unter Filename-Zeit abgelegt sind, und der nächste Run schreibt sie unter ODIM-Zeit neu.

## Was bewusst NICHT geändert wird
- Keine Projekt-Trennung. Messung + Prognose teilen sich nur Manifest und Renderkomponente — saubere Trennung über `frame.source` / `precipUrl` ist bereits vorhanden.
- Forecast-Tween (Canvas-Lerp) bleibt — dort ist die Wert-Interpolation passend.
- Hail-Layer, Farb-Skalen, Bbox, Filter (`blur(0.8px) contrast(2.2)`) bleiben unverändert.
- Frame-Dauer (750 ms) wird nicht angefasst; falls die 5-min-Mess-Frames im Snap-Modus zu schnell durchlaufen, können wir das später separat justieren.

## Geänderte Dateien
- `src/components/maps/radar-map.tsx` — PNG-Crossfade-Logik entfernen
- `scripts/ingest_radar.py` — Zeit-Quelle umstellen, Version bump
