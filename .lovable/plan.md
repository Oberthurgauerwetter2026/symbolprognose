## Ziel

Niederschlag (und Schnee) der ICON-CH1-Prognose so aufbereiten, dass jeder 15-min-Slot einen eigenen, linear interpolierten Wert zwischen den umgebenden Stunden-Ankerpunkten enthält. Damit verschiebt sich die Ns-Signatur beim Sliden **und** beim Play in echten 15-min-Schritten — statt 4× identisch und dann harter Stunden-Sprung.

## Änderung — `src/lib/radar.functions.ts`

In der Phase-1-Verarbeitung (`ref1.time` + `r1[pi].minutely_15`) **bevor** die Frames in `frames` gepusht werden, je Grid-Punkt eine Smoothing-Stufe einbauen:

1. Pro Grid-Punkt die Rohwerte aus `minutely_15.precipitation` (mm/15min × 4 → mm/h) und `minutely_15.snowfall` einlesen wie bisher.
2. Aus diesen ein Array von **Stunden-Ankern** ableiten: der Wert am `:00`-Slot (bzw. der erste Slot innerhalb jeder Stunde) zählt als Ankerwert für diese Stunde.
3. Für jeden 15-min-Slot `i` zwischen zwei Ankern (Stunde `H` und `H+1`) den Wert linear interpolieren:
   - Slot `:00` → 1.0 × Anker(H) + 0.0 × Anker(H+1)
   - Slot `:15` → 0.75 × Anker(H) + 0.25 × Anker(H+1)
   - Slot `:30` → 0.50 × Anker(H) + 0.50 × Anker(H+1)
   - Slot `:45` → 0.25 × Anker(H) + 0.75 × Anker(H+1)
4. Für den letzten Stundenblock (kein nachfolgender Anker mehr) fällt die Interpolation auf den letzten Anker zurück (= konstanter Wert).

Die Interpolation läuft komplett auf Frame-Ebene **nach** dem aktuellen `values[pi] = v*4`-Schritt und ersetzt nur die Forecast-Frames (`tMs > now`); Vergangenheits-Frames bleiben unangetastet.

### Implementierungsskizze

```ts
// Schritt 1: pro Grid-Punkt ein chronologisches Forecast-Array bauen.
// Schritt 2: Anker-Indizes finden (jeder 4. Slot beginnend beim ersten :00).
// Schritt 3: zwischen aufeinanderfolgenden Ankern linear interpolieren.
// Schritt 4: die interpolierten Werte zurück in die jeweiligen frame.values[pi] schreiben.
```

Da die Schleife heute über `ti` (Zeit-Index) außen und `pi` (Grid-Punkt) innen läuft, lege ich erst alle Frames an wie bisher, sammle anschließend pro `pi` die Forecast-Werte in einem Sub-Array, interpoliere, und schreibe zurück. Dasselbe für `snowValues`, sofern vorhanden.

## Animationspfad unverändert

Die bestehende Cross-Fade-Logik im Frontend bleibt — sie überblendet jetzt zwischen 15-min-Frames, die echte Zwischenwerte tragen. Dadurch wirkt die Animation doppelt geglättet (zeitlich interpoliert + visuell überblendet).

## Nicht angefasst

- Past-Cutoff −6 h, See-Styling, Slider-UI, Hagel-Layer, BBox, Farbskalen, Filter, Edge-Fade.
- Frontend / `PrecipOverlay` / Play-Loop / `useQuery` / Ingest-Skripte.
- Datenpfad für ICON-CH2 (kommt aktuell nicht zum Einsatz in den Frames, siehe `ref1`-Schleife only).

## Hinweis zur Semantik

Die linear interpolierten Zwischenwerte sind eine **visuelle Glättung**, kein zusätzliches Modell-Signal — Open-Meteo liefert für ICON-CH1 precipitation effektiv stündliche Akkumulationen. Für eine Radar-Symbolprognose-UI ist die Annäherung übliche Praxis (vergleichbar mit dem Verhalten von SRF Meteo).