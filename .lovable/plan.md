# Regentropfen besser sichtbar machen

Die Tropfen sind hellblau (#69b7e8) mit dünnem, mittelblauem Rand und gehen auf grauen Wolken unter.

## Lösung
- Tropfenfarbe kräftiger und satter (ca. #2f8fe0), damit sie sich klar vom Grau abhebt.
- Dunkelblauer Rand (ca. #0b3a6b), etwas dicker (0,7 → 1,0).
- Kleiner weisser Glanzpunkt bleibt als Lichtreflex.
- Gleich überall: App, alle Einbettungen und die serverseitig gezeichneten Symbole (Push, Einbettungen ohne Skript).

Form, Grösse und Fallanimation bleiben unverändert.

## Technisch
- `src/styles.css`: `--wx-drop`, `--wx-drop-edge`
- `src/components/weather-icons/index.tsx`: Fallback-Farben, stroke-width
- `src/lib/weather-icon-svg.server.ts`: Zeile 98 und CSS-Variablen Zeile 473
