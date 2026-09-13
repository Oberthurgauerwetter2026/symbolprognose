Schwacher Schatten am horizontal scrollbaren Tages-Strip

## Ziel
Im Lokalprognose-Widget soll der horizontal scrollbare Tages-Strip (`DayStrip` in `src/components/weather-widget.tsx`, Zeile ~700) am linken und rechten Rand einen schwachen Schatten zeigen, sobald Inhalt in diese Richtung verschwindet. Das gibt visuelles Feedback, dass weitere Tage scrollbar sind.

## Betroffene Stelle
- `src/components/weather-widget.tsx`, `DayStrip`-Komponente, Container-Zeile 700:
  ```
  <div className="flex gap-px bg-zinc-200 border border-zinc-200 rounded-md overflow-x-auto snap-x snap-mandatory no-scrollbar">
  ```

## Umsetzung
1. Scroll-Shadow-Utility in `src/styles.css` ergänzen:
   - Neue CSS-Klasse `.scroll-shadow-x` für horizontal scrollbare Container.
   - Verwendet `background-attachment: local, scroll` mit zwei sehr schwachen Gradienten:
     - linker Verlauf: von `var(--color-border)` / schwachem Schwarz zu transparent
     - rechter Verlauf: von transparent zu `var(--color-border)` / schwachem Schwarz
   - Die Gradienten werden nur sichtbar, wenn der Inhalt in die jeweilige Richtung scrollt (durch `background-attachment: local, scroll` realisiert).
   - Stärke: sehr dezent, z. B. `rgba(0,0,0,0.04)` oder `var(--color-border)` mit niedriger Opazität, damit es nicht auffällt.

2. `DayStrip`-Container anpassen:
   - Klasse `scroll-shadow-x` zum scrollbaren Wrapper hinzufügen.
   - Bestehende Klassen (`overflow-x-auto snap-x snap-mandatory no-scrollbar`) bleiben erhalten.
   - Optional: gleiches Verhalten auch für den stündlichen Verlauf (Zeile ~1153) prüfen und anwenden, falls gewünscht.

## Verhalten
- Kein Schatten, wenn der Strip ganz links oder ganz rechts ist und kein Overflow besteht.
- Schatten am linken Rand, wenn nach rechts gescrollt wurde.
- Schatten am rechten Rand, wenn weiterer Inhalt rechts folgt.
- Der Schatten liegt über dem Inhalt, ohne ihn zu blockieren (nur visueller Hinweis).

## Nicht im Scope
- Keine Änderung an Scroll-Logik, Snap-Verhalten oder Tagesauswahl.
- Keine Änderung an Grösse, Abstand oder Inhalt der Tageskarten.
- Keine neuen Abhängigkeiten.
