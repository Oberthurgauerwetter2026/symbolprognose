## Beobachtung

Aktuell ist das Warninfo-Panel in `warn-map.tsx` auf `h-[700px]` begrenzt und der Warnkarten-Text scrollt im rechten Bereich, wenn er länger ist (z. B. „Mögliche Auswirkungen …“). Das „Warnungen abonnieren“-Panel nimmt zusätzlichen Platz ein. Der Hinweistext (z. B. im Embed-Modus) ist immer sichtbar.

## Ziel

1. Die Warnmeldung soll vollständig lesbar sein (ohne inneres Scrollen).
2. Das „Warnungen abonnieren“-Panel soll noch kompakter werden.
3. Der Hinweistext soll erst nach Tippen/Klicken eingeblendet werden.

## Plan

1. **Layout & Größe prüfen**
   - Screenshot der aktuellen `/karten/warnungen` und des Embed-Views machen, um zu messen, wie viel Platz das Warninfo-Panel wirklich hat.

2. **Warninfo-Panel anpassen**
   - In `src/components/maps/warn-map.tsx` die feste Höhe des Info-Bereichs erhöhen oder auf `min-h`/`h-auto` umstellen, sodass eine einzelne Warnung komplett sichtbar ist.
   - Inneres `overflow-y-auto` der Warnliste nur aktivieren, wenn der Inhalt tatsächlich größer ist als der verfügbare Bereich (z. B. bei mehreren Meldungen). Bei einer einzelnen Meldung soll die Karte nicht innerhalb des Panels scrollen.
   - Abstände im Warninfo-Bereich leicht reduzieren, damit mehr Text sichtbar wird.

3. **Abonnieren-Panel komprimieren**
   - In `src/components/warnings/push-opt-in.tsx` Padding, Titelgröße und Zeilenabstand im Abonnement-Bereich verkleinern.
   - Den „Benachrichtigungen im eingebetteten Fenster“-Hinweis auf eine einzeilige Zeile mit Info-Icon reduzieren und den ausführlichen Text erst auf Tippen/Klicken einblenden.
   - Auch im nicht-eingebetteten Modus den Hilfetext „Wie funktioniert das?“ als klappbaren Link belassen, aber den Standardtext knapper halten.

4. **Embed-Route anpassen**
   - In `src/routes/embed.warnungen.tsx` das untere „Push-Benachrichtigungen aktivieren“-Segment kompakter gestalten (kleineres Padding, kürzere Texte).

5. **Verifizierung**
   - Build laufen lassen.
   - In der Preview prüfen: Warnmeldung ist vollständig sichtbar, Abonnieren-Panel ist kleiner, Hinweistext klappt auf.

## Betroffene Dateien

- `src/components/maps/warn-map.tsx`
- `src/components/warnings/push-opt-in.tsx`
- `src/routes/embed.warnungen.tsx`