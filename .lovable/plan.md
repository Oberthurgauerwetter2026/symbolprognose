# Regentropfen im Referenz-Stil

Die Tropfen in der Symbolprognose werden auf die Optik des hochgeladenen Referenzbildes umgestellt: schlanke, oben spitz auslaufende Tropfen mit weicher, heller Füllung und ohne harte dunkle Kontur. Alles andere an den Symbolen (Wolke, Sonne, Blitz, Schneeflocken, Nebel) bleibt exakt wie bisher.

## Was sich ändert

- **Form**: schlanker Tropfen, oben deutlich spitzer und länger auslaufend als heute, unten rund — Verhältnis Höhe zu Breite etwa 2,4 : 1.
- **Füllung**: heller, leicht durchscheinender Verlauf (oben nahezu weiss, unten leicht blaugrau) statt flächigem Kräftigblau.
- **Kontur**: keine dunkle Umrandung mehr. Stattdessen ein sehr feiner, halbtransparenter heller Rand, damit der Tropfen auch auf hellem Hintergrund lesbar bleibt.
- **Neigung**: leichte, einheitliche Neigung von etwa 8–10 Grad, ruhiger als die heutigen 12–15 Grad.
- **Anordnung**: gleiche Tropfen-Positionen und -Anzahl wie heute pro Symbol (Drizzle, Rain, SunShower, Thunderstorm, SunThunder) — nur die Glyphe selbst wird ersetzt, damit sich die Bildkomposition nicht verschiebt.

## Lesbarkeit klein und dunkel

Weil helle Tropfen auf hellem Hintergrund schwächer wirken, wird der Tropfen über die bestehenden Design-Tokens gesteuert: im Light-Theme etwas kräftigeres Blau im unteren Drittel, im Dark-Theme heller. Geprüft wird bei 24 px, 32 px und 64 px auf hellem und dunklem Grund.

## Technische Details

- `src/components/weather-icons/index.tsx`: die `Drop`-Komponente erhält den neuen Pfad, einen SVG-Verlauf (`linearGradient`, einmalig in `defs`) und den feinen hellen Rand anstelle von `stroke={C.rainEdge}`.
- `src/styles.css`: Tokens `--wx-rain` / `--wx-rain-edge` auf die neuen Werte (helle Spitze, weiche Basis) angepasst, je Theme.
- Keine Änderung an Wolke, Sonne, Blitz, Flake, Nebel oder an der Icon-Auswahl-Logik.
- Kontrolle über den Icon-Katalog (`/intern/icons`) mit Screenshots vorher/nachher.
