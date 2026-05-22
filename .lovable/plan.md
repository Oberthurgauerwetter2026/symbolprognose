## Ziel
Im grünen Region-Bereich (Oberthurgau) soll die Reliefschattierung deutlicher sichtbar werden. Aktuell überlagert die grüne Füllung (fillOpacity 0.55) das Relief und macht es flach.

## Ursache
Render-Reihenfolge in `src/components/region-map.tsx`:
1. Basiskarte
2. Relief (opacity 0.65)
3. Aussen-Maske grau
4. Thurgau grau
5. See blau
6. **Region grün (fillOpacity 0.55)** ← deckt Relief ab

## Lösung
Eine zweite Relief-Kachelschicht **über** der Region rendern, mit Clip auf den Region-Bereich nicht möglich in Leaflet ohne Custom-Layer. Einfachste wirksame Massnahme:

- **Region-Füllung transparenter machen**: `fillOpacity` von `0.55` → `0.28`, damit das darunterliegende Relief durchscheint.
- **Region-Outline beibehalten** (Farbe `#2561a1`, weight 2), damit der Bereich klar abgegrenzt bleibt.
- **Relief-Opacity leicht erhöhen** von `0.65` → `0.8`, damit Höhenstrukturen markanter werden (wirkt sich auch ausserhalb aus, aber dort liegt die graue Maske drüber und dämpft den Effekt).

## Umsetzung
Nur visuelle Prop-Änderungen in `src/components/region-map.tsx` (Zeilen 378–426). Keine Logik-Änderung.