# Regionskarte: Layout-Sprung durch Warnbanner verhindern

## Problem
Das Warnbanner wird nur bei aktiver Warnung gerendert. Erscheint oder verschwindet es (Zeitwechsel, Realtime-Update, Tageswechsel), verändert sich die Höhe über der Karte und die Karte springt hoch/runter.

## Lösung
Der Banner-Platz wird zu einem festen Slot mit konstanter Höhe:

- Immer ein Container über der Karte rendern, auch ohne Warnung — leer, aber mit derselben Höhe wie das Banner.
- Das Banner füllt diesen Slot; erscheint/verschwindet es, bleibt die Gesamthöhe und damit die Kartenposition unverändert.
- Ohne Warnung ist der Slot unsichtbar (kein Hintergrund, kein Rand) und für Screenreader ausgeblendet.

Damit bleibt die Karte optisch stabil, während Warnungen kommen und gehen.

## Technisch
In `src/components/region-map.tsx` wird `{warnBanner}` durch einen Slot-Wrapper mit fixer Höhe ersetzt (Höhe passend zum bestehenden `px-3 py-1.5 text-xs sm:text-sm` Banner, responsiv über eine feste Tailwind-Höhenklasse), der `warnBanner` oder ein leeres Platzhalter-Element enthält. Es entfällt der `space-y-4`-Sprung, der Abstand bleibt konstant. Keine Änderung an Filterlogik oder Backend.
