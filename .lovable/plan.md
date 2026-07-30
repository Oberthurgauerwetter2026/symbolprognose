## Ursache

`WarnMap` schaltet auf zwei Spalten erst ab Container-Breite `@3xl` (768 px) um (`src/components/maps/warn-map.tsx`, Zeile 398). Die Standalone-Seite `src/routes/warnkarte.tsx` rendert die Karte in einem Wrapper mit `max-w-3xl px-4`, also nur ca. 736 px nutzbare Containerbreite – knapp unter der Schwelle. Deshalb bleibt dort alles gestapelt, während Embed (`bare`) schon ab `@lg` umbricht.

## Änderung

1. **`src/routes/warnkarte.tsx`**
   - Wrapper von `max-w-3xl` auf `max-w-6xl` erhöhen, damit auf Desktop genug Breite für Karte + Infopanel vorhanden ist (gleich wie `/karten/warnungen`).

2. **`src/components/maps/warn-map.tsx`**
   - Den Zwei-Spalten-Breakpoint der App-Ansicht von `@3xl` auf `@lg` senken, damit Karte und Panel identisch zum Embed-Modus umbrechen. Betrifft die Klassen in Zeile 398, 548 und 573 (jeweils `@3xl:` → `@lg:`); damit sind bare- und App-Variante deckungsgleich.

Mobil bleibt alles unverändert gestapelt (`grid-cols-1`).

## Verifikation

TypeScript-Check plus Playwright-Screenshots von `/warnkarte` bei 390 px, 768 px, 1440 px – Panel muss ab Desktop rechts neben der Karte stehen, mobil darunter.