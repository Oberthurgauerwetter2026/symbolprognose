## Anpassung der Takt-Labels im Stundendetail-Panel

### Ausgangslage
Im Header des Tagesdetail-Panels (rechts oben) werden aktuell zwei Legenden-Labels angezeigt:
- **1-h-Takt**
- **3-h-Takt (ab +12 h)**

Zusätzlich gibt es bereits ein Inline-Label `ab +12 h · 3-h-Takt`, das oberhalb des ersten 3h-Slots erscheint (bei `isCadenceBreak`).

### Änderungen

1. **Header-Label "1-h-Takt" entfernen**
   - Datei: `src/components/weather-widget.tsx`
   - Zeile ~739–748: Den `<span>` mit dem Text `1-h-Takt` und seinem visuellen Trenner komplett entfernen.

2. **Header-Label "3-h-Takt (ab +12 h)" entfernen**
   - Zeile ~744–747: Den `<span>` mit dem Text `3-h-Takt (ab +12 h)` und seinem visuellen Trenner entfernen.
   - Damit verschwindet die gesamte Legende aus dem Header.

3. **Inline-Label am 3h-Übergang anpassen**
   - Zeile ~874–878: Das bestehende Label oberhalb des ersten 3h-Slots ändern von:
     ```
     ab +12 h · 3-h-Takt
     ```
     auf:
     ```
     3-h-Takt
     ```
   - Der Text soll also nur noch `3-h-Takt` lauten und direkt über dem Slot stehen, an dem der Taktwechsel stattfindet.

### Keine weiteren Änderungen
- Layout, Farben, Schriftgrößen und Logik der Slots bleiben unverändert.
- Die Darstellung der Wetterdaten (Temperatur, Niederschlag, Wind etc.) bleibt identisch.
