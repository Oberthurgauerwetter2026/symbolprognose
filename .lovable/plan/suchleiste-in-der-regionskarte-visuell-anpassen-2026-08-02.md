## Suchleiste in der Regionskarte visuell anpassen

Ziel: Die neu eingebaute Ortssuchleiste oben in der Regionskarte (`src/components/region-map.tsx`) soll weniger dominant wirken und nicht mehr direkt am oberen Bildrand kleben.

### Änderungen

1. **Deckkraft reduzieren**
   - In der `MapSearchBar`-Komponente den Hintergrund von `bg-primary/70` auf `bg-primary/45` (oder ein passendes transparentes Token) reduzieren, damit die Karte mehr durchscheint und die Leiste sich besser in das Kartenbild einfügt.

2. **Vom oberen Rand lösen**
   - Den äußeren Container von `absolute inset-x-0 top-0` auf `absolute left-2 right-2 top-2` umstellen.
   - Optional eine abgerundete Form ergänzen (`rounded-lg` / `rounded-xl`), sodass die Leiste wie eine frei schwebende Karte wirkt.

3. **Konsistenz prüfen**
   - Sicherstellen, dass die Dropdown-Liste bei der neuen Position korrekt nach unten ausgerichtet bleibt und keine horizontalen Scrollbalken entsteht.
   - Kurze visuelle Prüfung im Preview (Desktop + Mobile), ob der Kontrast zwischen Text und Hintergrund weiterhin lesbar bleibt.

### Betroffene Datei
- `src/components/region-map.tsx`
