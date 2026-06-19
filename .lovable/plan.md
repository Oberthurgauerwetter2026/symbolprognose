Plan: Lokalprognose-Kacheln auf Mobile verdichten

Ziel
---
Die Tages- und Stunden-Kacheln der Lokalprognose sollen auf mobilen Viewports (<640 px) kompakter dargestellt werden — gleiche Informationen, weniger Platzverbrauch.

Änderungen
---

### 1. DayStrip (Tageskacheln)
- Icon-Größe: `80` → `56` auf Mobile (`@[640px]:size={80}`)
- Padding: `p-3` → `p-2` auf Mobile (`@[640px]:p-3`)
- Innenabstände: `space-y-3` → `space-y-2` auf Mobile
- Temperatur-Range: Schrift etwas kleiner (`text-sm` statt `text-base` für Min, `text-lg` statt `text-xl` für Max auf Mobile)
- Regen/Wind-Zeile: `text-xs` bleibt, aber weniger vertikaler Abstand
- Wind-Block am Kachelfuß: Padding `pt-3` → `pt-2` auf Mobile, `space-y-1.5` → `space-y-1`

### 2. DetailPanel (Stundenkacheln)
- Padding: `p-3` → `p-2` auf Mobile (`@[640px]:p-3` oder `@[640px]:p-4`)
- Icon-Größe: `48`/`64` bleibt, aber ggf. `40`/`52` auf Mobile prüfen
- Vertikaler Abstand: `space-y-3` → `space-y-2` auf Mobile
- Zeitangabe und Temperatur: ggf. `text-sm` bleiben

### 3. Header-Bereich
- Weniger Abstand unter dem Header: `pb-5` → `pb-3` auf Mobile
- Ortungs-Button-Label "Ortung" bleibt auf `sm:inline` ausgeblendet (bereits OK)

Technische Umsetzung
---
- Tailwind-Container-Queries (`@[]`) für die Breakpoints nutzen, da das Widget bereits mit `@container` arbeitet
- Keine neuen Abhängigkeiten nötig
- Keine Logikänderungen, nur CSS/Tailwind-Utility-Änderungen in `weather-widget.tsx`

Test
---
- Preview auf Mobile-Viewport (390×844) prüfen
- Scrollverhalten der DayStrip bleibt unverändert
- Snap-Verhalten bleibt unverändert