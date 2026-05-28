## Ziel
Beim Öffnen der Radar-Karte (`/karten/radar` und Embed) soll der Slider **immer auf dem aktuellsten echten Radar-Messframe** stehen — nicht auf einem Nowcast- oder ICON-CH1-Prognoseframe, der zufällig näher an "jetzt" liegt.

## Aktuelles Verhalten
In `src/components/maps/radar-map.tsx` wählt `useNowFrameIndex()` den Frame mit der kleinsten Zeitdifferenz zu `Date.now()`. Da Nowcast-Frames (T+15…+90 min) und ICON-CH1-Frames in derselben Liste liegen, landet der Initial-Index regelmäßig auf einem Prognoseframe — insbesondere kurz nach einem Radar-Update, wenn der nächste Nowcast-Frame zeitlich näher an „jetzt" sein kann als der letzte Messframe.

## Änderung (rein Frontend)
In `src/components/maps/radar-map.tsx`:

1. `useNowFrameIndex` umbauen zu `useLatestRadarIndex`:
   - Suche den **größten Index** mit `frame.source === "radar"` und `Date.parse(frame.t) <= Date.now() + 60_000` (60 s Toleranz für Clock-Skew).
   - Fallback 1: letzter Frame mit `source === "radar"` überhaupt.
   - Fallback 2 (keine Radar-Frames vorhanden): bisheriges Closest-to-now-Verhalten als Sicherheitsnetz.
2. Initial-`setIdx`-Effekt unverändert lassen — er übernimmt den neuen Index automatisch.
3. Play/Loop-Logik und Slider-Verhalten bleiben gleich; nur der **Start-/Reset-Index** ändert sich.

## Optional konsistent
- Beim automatischen Refresh der Frames (neue Daten geladen, idx noch auf altem letzten Messframe) den Index nur dann nachziehen, wenn der Nutzer noch auf dem zuvor erkannten „latest radar"-Frame war (damit man beim Scrubben nicht weggerissen wird). Aktuell wird der Index nach erstem Setzen nicht mehr automatisch verschoben — Verhalten bleibt erhalten.

## Nicht-Ziele
- Keine Änderungen an Ingest, Nowcast-Berechnung, ICON-CH1-Blending oder Backend.
- Keine UI-Umbauten an Slider, Legende oder Labels.
