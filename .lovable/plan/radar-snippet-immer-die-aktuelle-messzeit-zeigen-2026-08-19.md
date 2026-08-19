# Radar-Snippet: immer die aktuelle Messzeit zeigen

## Problem

Im Radar-Embed (Widget und Vollversion) kann nach dem Neuladen ein älterer Frame stehen bleiben:

- Radardaten werden bis zu 24 h in `localStorage` zwischengespeichert (`wx-rq-cache-v2`) und gelten 5 Minuten als frisch. Beim Neuladen wird also zuerst der alte Stand gerendert, und wenn er jünger als 5 Minuten ist, wird gar nicht neu geladen — obwohl der Radar im 5-Minuten-Takt neue Messungen liefert.
- Es gibt kein automatisches Nachladen: Ein Embed, das länger offen bleibt (typisch auf einer WordPress-Seite), bleibt dauerhaft auf dem Stand vom Seitenaufruf.
- Der Startframe wird nur einmal gesetzt (solange noch kein Index existiert). Kommen später frischere Messungen an, bleibt der Zeiger auf dem alten Frame.

## Lösung

1. **Radardaten nicht mehr aus dem alten Speicher als "frisch" gelten lassen**: Radar-Frames werden beim Neuladen immer sofort neu geholt (kurze Frischezeit statt 5 Minuten). Der zwischengespeicherte Stand bleibt nur noch als sofort sichtbares Zwischenbild, bis die neue Antwort da ist.
2. **Automatische Aktualisierung**: Die Radarabfrage aktualisiert sich selbstständig etwa jede Minute sowie beim Zurückkehren zum Tab bzw. nach Verbindungsabbruch.
3. **Zeiger folgt der neuesten Messung**: Sobald neue Messframes eintreffen und der Nutzer weder scrollt noch abspielt und noch nicht selbst in die Zeitachse gegriffen hat, springt die Anzeige automatisch auf den aktuellen Frame — statt auf dem alten stehen zu bleiben.
4. **Widget-Modus (`/embed/widget-radar`)**: Die Zeit-Pille zeigt immer den jüngsten vorhandenen Messframe; sie folgt jeder Aktualisierung ohne Zutun.

## Technisches

- `src/lib/map-queries.ts`: `radarFramesQuery` erhält `staleTime` ≈ 30 s, `refetchInterval` ≈ 60 s, `refetchOnMount: "always"`, `refetchOnWindowFocus`/`refetchOnReconnect`. Zusätzlich wird `radar-frames` aus `PERSISTED_QUERY_PREFIXES` entfernt oder beim Hydrieren als veraltet markiert, damit kein alter Stand als frisch zählt (Vollansicht `/karten/radar` nutzt dieselbe Query und profitiert mit).
- `src/components/maps/radar-map.tsx`: neuer Effekt, der bei geändertem letzten Messframe `idx`/`renderMs` auf `nowIdx` nachzieht, gesteuert über ein `userInteractedRef` (gesetzt bei Scrub, Play, Pfeiltasten), damit eine manuelle Auswahl nicht überschrieben wird. Im `snapshot`-Modus greift das Nachziehen immer.
- Keine Änderungen an Ingest, Datenmodell oder anderen Kartentypen.
