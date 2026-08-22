# Lokalprognose: Suchfeld-Hinweis vereinfachen

## Ziel
Der blaue Hinweisblock unter dem Suchfeld in der Lokalprognose nimmt zu viel Platz ein. Er soll visuell schlanker werden, aber weiterhin sofort als Handlungsaufforderung erkennbar bleiben.

## Was gebaut wird

1. **Text verkürzen**
   - Kompakte, einzeilige Formulierung statt zweizeiliger Erklärung.
   - Vorschlag: **„Ort eingeben oder Ortung verwenden"** oder **„Gemeinde suchen oder Ortung verwenden"**.
   - Der Verweis auf „7-Tage-Prognose" entfällt im Hinweis, da das Widget selbst bereits als Lokalprognose wahrgenommen wird.

2. **Visuelle Reduktion**
   - Padding deutlich reduzieren (z. B. `p-3` statt `p-8`).
   - Pfeil-Icon entfernen oder durch ein kleines Such-/Ortungs-Icon ersetzen.
   - Hintergrundfarbe beibehalten (`bg-[var(--accent-soft)]`), aber Rahmen und Schatten leicht zurücknehmen.
   - Schriftgrösse auf `text-sm` belassen, aber nur noch eine Zeile.

3. **Kompakt-Variante angleichen**
   - Auch die `compact`-Darstellung (z. B. im Embed) auf denselben kurzen Text umstellen.
   - Padding an die schmalere Einbettung anpassen.

## Technische Hinweise

- Betroffene Datei: `src/components/weather-widget.tsx` (Zeilen ~423–438).
- Keine Änderung an Datenquellen, Server-Funktionen oder Routing.
- Tailwind-only: bestehende semantische Tokens (`--accent-soft`, `text-zinc-900`, `rounded-md`) verwenden.
- Keine neuen Abhängigkeiten.

## Prüfung

- Lokalprognose ohne gewählten Ort öffnen.
- Sicherstellen, dass der Hinweis deutlich kleiner ist und trotzdem als CTA erkennbar bleibt.
- Embed-Ansicht prüfen (kompakte Variante).
