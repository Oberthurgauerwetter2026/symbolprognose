## Ziel
Feine Sprenkel/isolierte Punkte in Radar-Messung **und** Prognose entfernen — **ohne** Glättung (keine Boxcar-/Median-Filter, keine zusätzlichen Blur-Passes) und **ohne** Crossfade zwischen Frames.

## Ansatz
Reiner **Isolated-Cell-Filter** in `src/components/maps/radar-map.tsx` — nur einzelne Ausreisser entfernen, restliche Pixel bleiben bit-genau erhalten.

## Regel
Für jede Zelle mit Wert > 0:
- Zähle die 8 Nachbarn (King-Neighborhood).
- Wenn **≥ 6 Nachbarn = 0** (bzw. unter Sichtbarkeitsschwelle) → Zelle auf 0 setzen.
- Sonst: Wert unverändert lassen.

Damit fallen einzelne Punkte und 1–2-Pixel-Cluster weg, während zusammenhängende Niederschlagsbänder komplett unangetastet bleiben. Keine Mittelung, keine Kantenweichzeichnung.

## Wo
- **Messung (MCH-PNG)**: nach dem Farb-Decode der Radar-Frames, vor dem Canvas-Draw.
- **Prognose (ICON-CH1-PNG)**: identisch nach dem Decode der Forecast-Frames.
- Anwendung in `redrawRef` und `buildOffscreenRef`, damit Live-Render und Frame-Cache konsistent sind.

## Nicht-Ziele
- Keine Glättung / kein Boxcar / kein Median / kein Gauss.
- Keine Änderung am Crossfade-Verhalten.
- Keine Änderung an Ingest-Skripten, Server-Funktionen oder Farbskala.

## Verifikation
`/karten/radar` öffnen, Timeline durch Messung und Prognose scrubben — Einzelsprenkel weg, harte Kanten und Blöcke bleiben unverändert.
