Auf Mobile darf die Karte etwas über den seitlichen Seiten-Padding hinausragen, damit mehr von der Region sichtbar ist. Die Wochentags-Pills bleiben unverändert in ihrer aktuellen Breite/Position.

Umsetzung in `src/routes/karten.region.tsx`:
- Nur die Karten-Komponente in einen Wrapper packen, der per negativem horizontalem Margin (`-mx-3 sm:mx-0`) den Container-Padding aufhebt — so nutzt die Karte auf Mobile die volle Viewport-Breite.
- `MapTabs` (Tab-Leiste oben) und `DayTabs` (Wochentage) bleiben unverändert innerhalb des bisherigen Paddings.

Alternativ kann auch direkt in `region-map.tsx` der äußere Karten-Wrapper (`<div className="relative h-[420px] w-full ...">`) den negativen Margin auf kleinen Breakpoints bekommen, sodass alle Seiten, die `RegionMap` einbinden, automatisch profitieren. Das ist die saubere Variante und wird so umgesetzt.

Keine weiteren Änderungen.