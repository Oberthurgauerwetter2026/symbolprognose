## Ziel

1. **Manuelles Ziehen** des Timesliders soll flüssig laufen (Griff + Zeit-Bubble folgen dem Finger/Cursor ohne Ruckeln).
2. **Play-Animation** springt in **stündlichem Abstand** durch die Frames, statt jeden 15-min-Frame abzuspielen.

## Änderungen in `src/components/maps/radar-map.tsx`

### A) Hourly Play-Loop (Zeilen ~1144–1176)

Statt blind `idx → idx+1` zu erhöhen, auf den nächsten **stündlichen** Frame springen.

- Neuer Memo `hourlyIndices`: für jede volle Stunde im Frame-Bereich den Frame mit `minute === 0` (oder zeitlich nächstgelegenen) — Array von Indizes in `frames`.
- Play-Tick: aktuellen Frame im `hourlyIndices` lokalisieren (oder nächst-folgenden), bei `progress ≥ 1` auf den nächsten Eintrag setzen; am Ende loopen.
- `FRAME_MS = 1800 / speed` bleibt (1 h-Schritt pro Tick); Cross-Fade zwischen Stundenframes ebenso.
- `nextFrame` (Zeile 1182) entsprechend auf den nächsten **Stundenframe** zeigen lassen, damit die Überblendung passt.

### B) Flüssigeres Scrubben in `MeteoTimeline` (Zeilen 831–1000)

Problem: Griff bewegt sich nur in Frame-Snaps; bei seltener Frame-Dichte oder schweren Overlay-Rerenders wirkt es ruckelig.

Plan:
- **Handle/Bubble von Frame-Snap entkoppeln**: während `dragging` die rohe Pointer-Pct in lokalem State `dragPct` (rAF-aktualisiert) halten. Griff + Bubble-Label-Zeit nutzen `dragPct`; Karten-Overlay erhält den gesnappten `idx` weiter via `onChange` — aber nur, wenn er sich tatsächlich ändert (Vergleich mit letztem gesendeten Index, kein redundanter Aufruf).
- Pointer-Move: `pendingXRef` setzen, im rAF sowohl `dragPct` updaten als auch ggf. `onChange(nearestIdx)`. So gleitet der Griff in jedem Frame, aber das schwere Overlay-Update läuft nur bei Indexwechsel.
- Beim PointerUp: `dragPct = null`, Griff rastet wieder auf `pctForIdx(idx)`.
- Bubble-Label: bei aktivem `dragPct` Zeit aus `tMin + dragPct·span` ableiten (auf 15 min runden für Anzeige), sonst wie bisher aus `currentFrame`.

### C) Keine Funktionsänderung außerhalb

- `colorFor`, Overlays, Ingest, Forecast-Logik: unverändert.
- Speed-Popover, Buttons, Layout: unverändert.

## Erwartetes Verhalten

- Play: jede ~0.9 s (bei 2×) ein Stundenschritt mit weicher Crossfade.
- Drag: Griff + Bubble folgen dem Cursor fließend, Niederschlagsfeld wechselt bei jedem überschrittenen Frame ohne sichtbares Ruckeln.
