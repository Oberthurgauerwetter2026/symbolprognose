## Weicherer Übergang an den Farbgrenzen

Aktuell ist der Übergangsbereich zwischen zwei Windgeschwindigkeitsbändern auf ±2 km/h eingestellt (also 4 km/h Gesamtbreite). Das ergibt noch recht scharfe Kanten.

**Änderung:** `HALF` von `2` auf `3` erhöhen → Übergangsbereich wird ±3 km/h (6 km/h Gesamtbreite). Das macht die Kanten an den Farbgrenzen deutlich weicher, ohne die diskreten Bänder in der Mitte zu verwischen.

**Betroffene Datei:** `src/components/maps/wind-map.tsx` (Zeile mit `const HALF = 2;`)

**Technisch:** Nur Konstanten-Änderung, keine neue Logik.