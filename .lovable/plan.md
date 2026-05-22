# Zeitschieberegler im Stil des Screenshots

Den Slider-Bereich in `src/components/region-map.tsx` (Zeilen ~470–550) so umbauen, dass er der Vorlage entspricht:

## Visuelle Struktur

- **Über dem Thumb**: schwebendes Tooltip-Label „Prognose: {Wochentag}, {HH:MM}" mit Brand-Hintergrund, weisser Schrift, abgerundet, kleines Dreieck nach unten. Position folgt dem Thumb (`left: ${(stepOffset/MAX_STEPS)*100}%`, `translateX(-50%)`).
- **Slider-Track**: dünn, mit vertikaler Marker-Linie am aktuellen Wert (durchgehend von oben bis unter die Labels), wie im Screenshot.
- **Tick-Reihe**: pro Stunde ein langer Tick + Beschriftung `HH:00` (24 Labels statt aktuell 9). Optional zusätzliche kurze Sub-Ticks zwischen den Stunden für Optik.
- **Unter dem Slider links**: Datum-Label „{Wochentag}, {TT.MM.JJJJ}" der aktuell ausgewählten Stunde (klein, muted).
- Footer „jetzt / +24 Std" entfällt (durch Tooltip + Datum ersetzt).

## Verhalten

- Schritte bleiben **1 Stunde** (`MAX_STEPS = 24`, `step = 1`).
- Tooltip-Zeit zeigt `HH:00` der gewählten Stunde (kein Halbstunden-Step; die `05:30` im Screenshot kommt aus deinem Mockup — ich nehme volle Stunden, passend zum aktuellen Datenraster).
- Tooltip-Wochentag + Datum berechnen sich aus `now + stepOffset Stunden` (rollt korrekt über Mitternacht in den nächsten Tag).
- Im Tagesmodus (`viewMode === "daily"`): Tooltip ausblenden, Slider weiter dimmed/disabled wie bisher.

## Responsiv

- Auf Mobile (`<sm`): nur jede 3. Stundenbeschriftung sichtbar (`hidden sm:inline` auf den Zwischenlabels), Ticks bleiben pro Stunde. So bleibt es lesbar.

## Aus Scope

- Keine Änderungen an Pills, Karte, Daten-Fetching, Tagesansicht-Toggle, Nachrück-Logik.

## Technische Details

- Neue Helper: `tickHours = Array.from({length: 25}, (_, i) => i)` für 0…24.
- Neuer State braucht's nicht — Tooltip-Position aus `stepOffset / MAX_STEPS`.
- Datum: `new Date(); d.setHours(baseHour + stepOffset, 0, 0, 0)` → mit `Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })` formatieren.
