# Regentropfen: Variante C — weiss mit weichem Rand

Die Tropfen in der Symbolprognose werden auf Variante C umgestellt: schlanker, oben spitz auslaufender Tropfen mit heller, fast weisser Füllung und weichem blaugrauem Rand — statt des heutigen kräftigblauen Tropfens mit dicker dunkler Kontur. Alles andere an den Symbolen (Wolke, Sonne, Blitz, Schneeflocken, Nebel) bleibt exakt wie bisher.

## Was sich ändert

- **Form**: schlanke Silhouette, oben deutlich spitzer und länger auslaufend, unten rund (Höhe zu Breite ca. 2,4 : 1).
- **Füllung**: vertikaler Verlauf von weiss (oben) zu hellem Blaugrau (unten).
- **Kontur**: dünner, weicher blaugrauer Rand (0,7) statt der heutigen dunklen 1er-Kontur.
- **Neigung**: ruhige, einheitliche 10 Grad.
- **Anordnung**: gleiche Tropfen-Positionen und -Anzahl wie heute in jedem Symbol (Drizzle, Rain, SunShower, Thunderstorm, SunThunder) — nur die Glyphe selbst wird ersetzt, damit sich die Bildkomposition nicht verschiebt.

## Lesbarkeit

Geprüft wird bei 24 px, 32 px und 64 px auf hellem und dunklem Grund. Der Verlauf und der weiche Rand sorgen dafür, dass der Tropfen auf beiden Hintergründen gleich stabil bleibt.

## Technische Details

- `src/components/weather-icons/index.tsx`: die `Drop`-Komponente erhält den neuen Pfad, einen einmalig definierten `linearGradient` in `<defs>` und den feinen Rand; Aufrufer bleiben unverändert.
- `src/styles.css`: Tokens `--wx-rain` / `--wx-rain-edge` auf die neuen Werte (weisse Spitze, weicher blaugrauer Rand) angepasst, je Theme.
- Keine Änderung an Wolke, Sonne, Blitz, Flake, Nebel oder an der Icon-Auswahl-Logik.
- Kontrolle über den Icon-Katalog (`/intern/icons`) mit Screenshot-Vergleich.
