## Ziel

In den ersten 12 Stunden ab dem aktuellen Zeitpunkt das Detail-Panel im **1-Stunden-Takt** zeigen, danach wie bisher im 3-Stunden-Takt. Optisch sauberer Übergang.

---

## Änderungen

Alle in `src/components/weather-widget.tsx`, keine Datenebene betroffen (ICON-CH1 liefert bereits stündliche Daten).

### 1. `allHourly` — Auswahl-Logik anpassen

Aktuell (ca. Zeile 107–125): jeder Index nur, wenn `hours % 3 === 0` und `t >= curBlockMs`.

Neu:
- `curHourMs` = aktuelle volle Stunde (statt 3-h-Block).
- `cutoffMs` = `curHourMs + 12 * 3600_000` (Ende des stündlichen Fensters).
- Für jeden Stunden-Index `i`:
  - wenn `t < curHourMs` → skip
  - wenn `t < cutoffMs` → immer aufnehmen (stündlich)
  - sonst → nur wenn `t.getHours() % 3 === 0` (3-h-Takt)

Das ergibt eine kontinuierliche Liste: 12× 1 h + danach 3-h-Slots bis Ende.

### 2. Aktueller-Block-Highlight

In `DetailPanel` (Zeile 510–515) wird `currentBlockMs` aktuell auf 3-h gerundet. Anpassen:
- Im 1-h-Fenster: aktuelle volle Stunde markieren.
- Im 3-h-Bereich: aktuellen 3-h-Block markieren (alte Logik).

Praktisch: pro Slot prüfen, ob `slotMs === currentHourMs` ODER (Slot im 3-h-Bereich UND `slotMs === current3hBlockMs`).

Einfacher: bei jedem Slot `isCurrent = slotMs <= now < slotMs + slotDurationMs`, wobei `slotDurationMs = 3600_000` für 1-h-Slots, `3 * 3600_000` für 3-h-Slots. Dafür müssen wir wissen, ob ein Slot im 1-h- oder 3-h-Bereich liegt — entweder via Index-Position (`< 12`) oder via separater Flag-Liste.

### 3. Visueller Trenner zwischen 1-h- und 3-h-Bereich

`allHourly` ändern auf `{ idx: number; cadence: "1h" | "3h" }[]` (oder zwei parallele Arrays). Im Slot-Rendering:
- Erster Slot mit `cadence === "3h"` bekommt links eine zusätzliche Trennlinie (`border-l-2 border-zinc-300`) und ein kleines Label oben: `„ab +12 h · 3-h-Takt"` (absolut positioniert, klein, zinc-500).
- Slot-Breite im 1-h-Bereich kann minimal schmaler sein als im 3-h-Bereich (z. B. `min-w-[68px]` vs. `min-w-[80px]`), damit die feinere Auflösung kompakt bleibt.

### 4. Niederschlagsbalken / Aggregation

Niederschlag pro 3-h-Slot ist heute eine Summe über 3 Stunden (vermutlich). Für 1-h-Slots: nur die eine Stunde anzeigen. Skala bleibt gleich, Balken werden im 1-h-Bereich entsprechend niedriger — das ist physikalisch korrekt und gewollt.

Falls eine gemeinsame Max-Skala über alle sichtbaren Slots verwendet wird: das passt automatisch weiter.

### 5. Day-Sync (Scroll-Listener)

Funktioniert unverändert weiter — die Logik basiert auf `iso.slice(0,10)` jedes sichtbaren Slots, unabhängig vom Takt.

---

## Was unverändert bleibt

- `src/lib/weather.ts`: keine Änderung. ICON-CH1 liefert bereits stündliche Daten, die in `hourly.time` enthalten sind.
- DayStrip, Header, Footer, Embed-Logik: unverändert.
- Datenmenge: minimal mehr DOM (≈ 8 zusätzliche Slots), kein Performance-Problem.

---

## Offene Mini-Entscheidung

Trenner-Label-Text — Vorschlag: **„ab +12 h · 3-h-Takt"**. Falls du etwas anderes willst (z. B. nur eine Trennlinie ohne Label), sag Bescheid; sonst nehme ich diesen Text.