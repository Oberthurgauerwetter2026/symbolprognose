## 1) Skala in 5-km/h-Schritten

Statt der Beaufort-Schwellen feste, intuitive 5er-Schritte von 0 bis 100+:

```text
0 · 5 · 10 · 15 · 20 · 25 · 30 · 35 · 40 · 50 · 60 · 70 · 80 · 100+ km/h
```

(Schritte ab 40 km/h auf 10er, weil oberhalb von 40 km/h Böen 5er-Schritte optisch nicht mehr unterscheidbar wären und die Legende sonst zu lang wird. Falls du strikt 5er bis 100 willst → sag Bescheid.)

Farbverlauf bleibt im gleichen Charakter (blau → türkis → grün → gelb → orange → rot → violett), nur sauber interpoliert über die neuen Stützpunkte. Übergangsfunktion (`HALF`) wird auf `2` km/h reduziert, damit bei 5er-Schritten innerhalb der Bänder noch eine klare Stufe sichtbar bleibt.

## 2) Windpfeile als optionaler Toggle

Aktuell: 3-Modi-Schalter „Strömung / Pfeile / Beide", Default ist **Beide** → Pfeile sind also immer an.

Neu:
- **Strömung (Partikel)** ist immer an, kein Toggle mehr nötig.
- **Pfeile** sind ein eigenständiger Ein/Aus-Schalter, **Default: aus**.
- Hinweis „ab Zoom 11 sichtbar" bleibt direkt am Toggle.

UI: Der bisherige Dreifach-Tabs-Schalter wird ersetzt durch einen einzelnen Switch „Pfeile" (shadcn `Switch` mit Label).

## Betroffene Datei

`src/components/maps/wind-map.tsx`:
- `WIND_SCALE` (Zeilen 35–49) → neue 5er-Schritte + Farben
- `HALF` (Zeile 47 alt) auf `2`
- `DisplayMode` + `mode`-State → ersetzen durch `arrowsOn: boolean` (Default `false`)
- Modus-Tabs-UI (~Zeile 1325–1350) → durch einen Switch ersetzen
