## Ziel

Solange MeteoSchweiz keine aktuellen OGD-Radardaten liefert (aktuell seit 11.06.2026 ~07:35 UTC, 0 Assets heute), zeigt die Karte (a) einen ehrlichen Status-Hinweis und (b) automatisch RainViewer-Tiles als Live-Fallback. Sobald MCH wieder liefert, wird ohne weitere Aktion auf MCH zurückgeschaltet.

## Verhalten

- Bei jedem Aufruf wird das Alter des neuesten MCH-Radarframes bestimmt.
- Schwelle: **≤ 20 min** = MCH frisch → bisheriges Verhalten unverändert.
- **20–60 min** = "MCH verzögert" → Banner zeigt Verzögerung, MCH-Frames bleiben sichtbar.
- **> 60 min oder 0 MCH-Frames in den letzten 6 h** = "MCH-Ausfall" → Banner zeigt Ausfall + letzten verfügbaren Zeitstempel, **RainViewer-Layer aktiv**, MCH-Frames werden nicht mehr animiert.

Auf der Karte erscheint im RainViewer-Modus ein Quellen-Label „Radar: RainViewer (MCH-Daten nicht verfügbar)" mit Zeitstempel des aktuellsten RainViewer-Frames.

Die Prognose-Schicht (ICON-CH1) bleibt unverändert — sie ist vom MCH-Ausfall nicht betroffen.

## Umfang

- `src/lib/radar.functions.ts`
  - Neuestes MCH-Frame-Alter berechnen, neue Felder im Server-Response: `radarStatus: "fresh" | "delayed" | "down"`, `radarLastFrameAt`, `radarAgeMin`.
  - `manifest.warning` aus dem Manifest übernehmen (heute ignoriert).
  - `hasRealRadar` strenger: mindestens ein Frame ≤ 60 min.
  - Bei `down` keine zusätzliche Serverarbeit für RainViewer — Client lädt direkt.
- `src/components/maps/radar-map.tsx`
  - Status-Banner-Komponente (drei Zustände, Farben über bestehende Tokens, kein Hardcoding).
  - RainViewer-Tile-Layer (Leaflet `L.tileLayer`) nur bei `radarStatus === "down"`; URL-Template aus `weather-maps.json` (`{host}{path}/256/{z}/{x}/{y}/2/1_1.png`).
  - Animations-Loop nutzt im Fallback-Modus die RainViewer-Frames (past + nowcast) statt MCH-PNGs.
  - Quellen-Label unter der Karte zeigt Quelle + Zeitstempel dynamisch.
- Keine Änderung an `scripts/ingest_radar.py`, R2-Manifest-Format oder Cron — der Ausfall ist eine Lieferseite, nicht ein App-Bug.

## Technisches

- RainViewer ist kostenlos, kein Key, CORS offen, weltweite Coverage inkl. CH. Update alle 10 min, Latenz 2–10 min.
- Manifest-URL: `https://api.rainviewer.com/public/weather-maps.json` (Client-Fetch, 60 s SWR).
- Tile-URL: `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png` (Color-Scheme 2 = Universal Blue, Smooth + Snow).
- Schwellen (`STALE_DELAY_MIN=20`, `STALE_DOWN_MIN=60`) als Konstanten in `radar.functions.ts`, leicht justierbar.
- Attribution „© RainViewer" gemäss deren Lizenz im Karten-Footer ergänzen, wenn Layer aktiv.
- Keine neuen Secrets, keine neuen Backend-Routen, keine DB-Änderungen.

## Out of Scope

- Kommerzielle MCH-Quelle (Meteomatics/metradar) — eigener Plan, sobald Bedarf.
- Korrektur des stillen Fallbacks in `scripts/ingest_radar.py` (alte Frames werden im Manifest nicht markiert). Empfehlung kann in einem Folgeschritt umgesetzt werden, ist für den UI-Ehrlichkeitsfix aber nicht zwingend, weil der Server jetzt das Alter selbst prüft.
