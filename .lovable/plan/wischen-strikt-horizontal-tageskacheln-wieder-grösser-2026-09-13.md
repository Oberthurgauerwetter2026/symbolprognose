# Wischen strikt horizontal + Tageskacheln wieder grösser

## Ziel
1. In der Lokalprognose darf sich beim Wischen über die Stunden- und Tagesleisten **kein** Inhalt mehr vertikal mitbewegen.
2. Die Tageskacheln werden wieder etwas grösser (Symbol, Texte, Abstände), ohne den zuletzt reduzierten Kompakt-Look komplett rückgängig zu machen.

## Änderungen

### 1. Vertikale Bewegung sperren — `src/components/weather-widget.tsx`
- **Tagesleiste (DayStrip, ~Zeile 795):** erhält ebenfalls `touch-pan-x overscroll-x-contain` (hatte bisher keine Touch-Ausrichtung — daher vertikales Mitwippen beim diagonalen Wischen).
- **Beide Stundenleisten (kompakt ~Zeile 736, vollständig ~Zeile 1252):** bereits `touch-pan-x`; zusätzlich `overscroll-behavior: none` in Y-Richtung (kein Überscroll-Nachziehen der Seite aus dem Panel heraus) und horizontale Scroll-Snap-Eigenschaften bleiben.
- Feste Zeilenhöhen bleiben unverändert (kein internes Springen).
- Verifizierung per mobilem Browser-Test: diagonales Wischen über die Leisten verändert die Y-Position des Panels nicht.

### 2. Tageskacheln vergrössern — `DayStrip` (Zeilen 803–866)
- Padding `p-2 → p-2.5` (Desktop `p-3.5`), innerer Abstand `space-y-1 → space-y-1.5`.
- Wochentag/Datum eine Stufe grösser (`text-sm → text-base` mobil für den Wochentag; Datum `text-[11px] → text-xs`).
- Wetter-Symbol: CSS-Klammer `h-10/w-10 → h-12/w-12` (Desktop `h-14/w-14`), `size`-Prop 56 → 64.
- Temperaturen: Max-Temp `text-base → text-lg` (Desktop `text-xl`), Min entsprechend eine Stufe.
- Niederschlagszeile: Betrag `text-xs → text-sm`, Sparkline bleibt kompakt (`h-6`).
- Ergebnis: Kacheln wirken gefüllter und besser lesbar, bleiben aber deutlich kompakter als die ursprüngliche Grossvariante.

## Technische Details
- Nur CSS-Klassen und der `size`-Prop; keine Logik-, Daten- oder API-Änderungen.
- Keine Auswirkung auf Embeds ausserhalb der Lokalprognose; feste Detail-Embeds unverändert.
- Checks: `bunx tsgo --noEmit`, Build-Log, Playwright-Mobile-Test (Wischen → Y stabil, Screenshot Kachelgrösse).
