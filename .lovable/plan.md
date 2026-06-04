Weitere leichte Reduktion der Radar-Prognose-Glättung:

1. **CSS-Filter Kontrast** — `contrast(1.25)` auf `contrast(1.35)` erhöhen (scharfere Konturen, weniger weiche Übergänge).
2. **Off-Screen-Blur** — `blur(0.6px)` auf `blur(0.3px)` reduzieren (weniger Weichzeichnung der ICON-CH1-Zellen, aber noch ausreichend, um harte Pixel-Blöcke zu vermeiden).

Die Alpha-Ramp (0.05 → 0.1) und `colorForSmooth` bleiben erhalten, damit die Prognose nicht wieder fleckenartig wird.