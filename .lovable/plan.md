Zeitslider: Abstand zwischen Tooltip und Schiebebutton vergrößern

Aktuell sitzt der Tooltip (`absolute top-0`) dicht über dem Slider, da der Container nur `pt-5` hat.

Änderung in `src/components/region-map.tsx`:
- `pt-5` des Slider-Containers (Zeile ~531) auf `pt-10` erhöhen.
- Dadurch wächst der Abstand zwischen Tooltip-Anzeige und Schiebebutton deutlich.