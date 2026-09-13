# Regenanzeige im Stundendetail kompakter gestalten

Die Regenanzeige im ausgeklappten Stundenprognose-Panel nimmt aktuell viel vertikalen Platz ein – vor allem bei trockenen Perioden, wo die 0–5 mm/3h-Skala einen grossen leeren Bereich zeigt. Ziel ist, die Höhe deutlich zu reduzieren, ohne die Information zu verlieren.

## Was geändert wird

- **Diagrammhöhe reduzieren:** Die Regenbalken-Fläche (`h-[72px]`) und die linke Y-Achse (`h-[72px]`) auf ca. `h-[48px]` verkleinern. Die Skalenbeschriftungen (5 / 2,5 / 0) bleiben erhalten, werden aber enger gesetzt.
- **Untere mm/%-Zeile entfernen:** Die Zeile unter dem Diagramm, die pro Slot nochmals `mm` und `Regenrisiko %` als Text wiederholt, entfällt. Die Werte sind weiterhin im Tooltip beim Tippen/Hover auf die Balken verfügbar.
- **Achsenbeschriftung kompakter:** Das Label „mm/3h“ links unten bleibt, wird aber enger an das reduzierte Diagramm angeglichen.
- **Sonnen- und Schneechart mitziehen:** Falls `extended` (Sonnenschein) oder `snow` aktiv ist, werden auch deren Diagrammhöhen von `h-[72px]` auf `h-[48px]` reduziert, damit das Panel insgesamt proportional kompakter wird.

## Was bleibt gleich

- Die farbigen Regenbalken, die Unsicherheitsbänder (10–90 %) und die Tooltips bleiben erhalten.
- Die Interaktionen (Hover/Tippen für Details) funktionieren weiterhin.
- Die Logik zur Berechnung der Balkenhöhen und der Sichtbarkeit von Regenrisiko-Bändern ändert sich nicht.

## Validierung

- Typecheck und Build prüfen.
- In der Vorschau ein trockenes und ein regnerisches Stundenpanel betrachten; die Regenanzeige soll deutlich weniger Höhe verbrauchen und trotzdem lesbar sein.
