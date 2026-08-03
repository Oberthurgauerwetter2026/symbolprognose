# Regionskarte: Suchfeld heller und transparenter

## Ziel

Das halbtransparente Ortssuchfeld oben in der Regionskarte soll weniger dominant wirken: heller und stärker durchscheinend.

## Vorgeschlagene Änderung

1. In `src/components/location-search.tsx` (Overlay-Variante) den Hintergrund anpassen:
   - Deckkraft von `bg-primary/30` auf `bg-primary/15` senken, damit die Karte deutlich mehr durchschimmert.
   - `backdrop-blur-sm` auf `backdrop-blur-md` erhöhen, damit das Feld trotz der geringeren Deckkraft als Glas-Element lesbar bleibt.
   - `shadow-sm` beibehalten oder auf `shadow-none` reduzieren, um den dunklen Halo zu minimieren.

2. Text und Icon im Overlay bleiben hell (`text-primary-foreground/90`) – damit behält der weiße Text auf der heller werdenden Leiste ausreichend Kontrast.

3. Visuelle Prüfung:
   - Screenshot auf Desktop und Mobile, ob das Suchfeld trotz höherer Transparenz noch gut lesbar ist.
   - Falls nötig, Kontrast nachträglich optimieren (z. B. leichter Text-Schatten oder leicht hellerer Tint).

## Betroffene Dateien

- `src/components/location-search.tsx`
- Ggf. `src/styles.css`, falls ein neues Utility-Token für Schatten/Lesbarkeit nötig wird
