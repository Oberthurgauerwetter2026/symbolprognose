## Änderungen in `src/components/weather-widget.tsx`

### 1. Detail-Panel: keine vertikalen Trennstriche, dafür Niederschlags-Balkenleiste

In den Stunden-Slots:
- `border-l-2 border-accent/50` / `border-l border-zinc-200` zwischen den Stunden **entfernen**. Tagesgrenze bleibt nur durch leichte Hintergrundabstufung (z.B. dezenter `bg-zinc-100/40` für geraden Tag) sichtbar, kein Strich.
- Den bestehenden vertikalen Mini-Balken + Text-Block "Niederschlag in jedem Slot" aus den Slots **herausnehmen**.

Neuer Layer **unterhalb der Slot-Reihe**, gleich breit, scrollt synchron (gleicher Container):
- Höhe ca. 64 px, eigene Säulen-Spalte pro Stunden-Slot (gleiche Slot-Breite `w-[108px] @[640px]:w-[124px]`).
- Hintergrund: 3 horizontale Gridlines (`border-t border-zinc-200/70`) bei 25 % / 50 % / 100 % entsprechend Achse 0 / 2.5 / 5 mm (3-h-Summe).
- Linke Y-Achsen-Label-Spalte (sticky links): "mm/3h" mit Werten 0 / 2.5 / 5.
- Pro Slot eine zentrierte Säule (`bg-[var(--wx-rain)]`, Breite ~10 px, abgerundet oben), Höhe = `min(precip / 5, 1) * 100%`. Opacity weiterhin nach `precipitation_probability`.
- Darunter (oder im Tooltip) Zahl + %.

Slot-Inhalt oben wird dadurch schlanker: Uhrzeit, Icon, Temperatur, Wind, Schnee — Niederschlag wandert komplett in die neue Leiste.

### 2. Tages-Übersicht: erweiterte Anzeige → Sonnen-Säulenleiste

Wenn `extended === true`, zusätzlich zur Karten-Reihe **darunter** eine Sonnenstunden-Leiste rendern:
- Gleiche 7-Spalten-Struktur wie `DayStrip` (`flex` / `@[900px]:grid grid-cols-7`), gleiche Spaltenbreiten/Snap-Verhalten.
- Höhe ca. 72 px, horizontale Gridlines bei 0 / 5 / 10 / 15 (h/Tag, Max-Skala 15 h).
- Linke Y-Achsen-Label-Spalte: "Sonne h/Tag" mit Werten 0 / 5 / 10 / 15.
- Pro Tag eine Säule mit Höhe = `sunshine_duration / (15 * 3600)`, Farbe `var(--wx-sun)`, abgerundete Oberkante.
- Beschriftung unter der Säule: `X.Y h`.
- Bei `extended === false` wird die Leiste nicht gerendert; die bisherigen `Sonne`/Sonnenauf-/-untergang-Zeilen in den Karten bleiben für Detail-Info erhalten — oder wandern aus den Karten in die neue Leiste (Tooltip + ↑/↓ unter der Säule). **Vorschlag**: in den Karten Sonnen-Zeile entfernen, weil redundant; Sonnenauf-/-untergang als kleine `↑hh:mm  ↓hh:mm` unter der Säule.

### 3. Tagesgrenze im Detail-Panel sichtbar halten

Da der vertikale Strich entfällt:
- Im neuen Niederschlags-Layer eine **dezente vertikale Linie** (oder Mini-Label "Mi 20.05.") bei jedem `isDayStart` einblenden, wie im SRF-Screenshot — z.B. `border-l border-zinc-300` nur im Achsenbereich (nicht in den Slots oben), plus kleines Datum-Label unten in der Achse.

## Nicht enthalten

- Keine Änderung an Datenquellen, Modell-Logik oder API-Parametern.
- Keine Umstellung auf Recharts/D3 — die Balken werden mit reinem Tailwind/Flex umgesetzt (leichtgewichtig, embed-tauglich).
- Layout/Farb-Tokens unverändert.
