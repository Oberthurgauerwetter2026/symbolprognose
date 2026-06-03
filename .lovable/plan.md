## Hintergrundkreis entfernen & Schatten verstärken

**Ziel:** Die Wetter-Icons auf der Karte (in `MarkerPill`) sollen ohne den zuletzt hinzugefügten Hintergrundkreis dargestellt werden, dafür aber mit einem deutlich stärkeren Schatten.

### Änderungen in `src/components/region-map.tsx`

1. **Hintergrundkreis entfernen**  
   Den absolut positionierten `<span>` mit `borderRadius: "50%"`, `background: "rgba(255,255,255,0.85)"` und `boxShadow` (Zeilen 213–222) löschen.

2. **Drop-Shadow der Icons verstärken**  
   Den `filter: "drop-shadow(...)"` auf dem WeatherIcon-Wrapper (Zeile 223) von `0 1px 2px rgba(0,0,0,0.2)` auf einen stärkeren Wert erhöhen, z. B. `0 3px 5px rgba(0,0,0,0.35)`.

Keine weiteren Dateien oder Layout-Änderungen notwendig.