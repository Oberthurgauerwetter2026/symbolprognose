## Ziel

Die letzte Änderung an der Niederschlags-Farbskala (`SCALE` + `colorFor`) hat zwei Nebenwirkungen verursacht:

1. **Prognose** (ICON-CH1/CH2): Formen und Farben sind nicht mehr wie ursprünglich geplant — die quantisierten Bänder erzeugen harte Iso-Konturen statt der weichen MeteoSchweiz-typischen Verläufe.
2. **Messung**: Im Canvas-gerenderten Ring um den MeteoSchweiz-PNG-Ausschnitt (ICON-CH1 `past_minutely_15`) springen Pixel von Frame zu Frame zwischen den harten Bändern hin und her — sichtbarer Flicker.

Beides hat die gleiche Ursache: `colorFor` wurde von **log-Interpolation zwischen Stützpunkten** auf **harte Bänder** umgestellt, und die `SCALE`-Tabelle wurde gleichzeitig auf eine andere mm/h-Stufung umgestellt.

→ Rückgängig machen. Nur `src/components/maps/radar-map.tsx`, sehr punktuell.

## Änderungen

### `src/components/maps/radar-map.tsx`

**`SCALE` zurück auf ursprüngliche MeteoSchweiz-Stützpunkte:**

```text
 0.2  hellblaugrau   [167,174,211]
 1    blau           [ 30, 60,230]
 2    dunkelgrün     [ 30,120, 50]
 4    grün           [ 70,200, 70]
 6    gelb           [240,235, 50]
10    hellorange     [240,200,120]
20    orange         [240,140, 30]
40    rot            [225, 30, 30]
60    violett        [150, 30,200]
```

Kommentar oben: „Niederschlags-Farbskala (mm/h) — MeteoSchweiz-Legende."

**`colorFor` zurück auf log-Interpolation** zwischen benachbarten Stützpunkten (statt quantisierte Bänder). Alpha:
- unterster Übergang (`i === 0`): von 0.45 → 0.92 (schwächste Stufe niedriger, damit starke Zellen keinen breiten Halo bekommen)
- alle übrigen Übergänge: 0.92
- oberhalb des höchsten Stützpunkts: 0.95

Damit verschwindet sowohl der Flicker im Messring als auch die zu kantige Prognose-Optik.

### Nicht angefasst

- `SNOW_SCALE` / `snowColorFor` — war nicht Teil der Regression.
- `src/lib/radar.functions.ts` — Messung→Prognose-Pipeline, Bias-Korrektur, Forecast-Cutoff bleiben unverändert (die Nowcast-Entfernung aus dem vorherigen Schritt steht).
- Legende rechts oben — übernimmt die neue SCALE automatisch.

## Verifikation

- `/karten/radar` öffnen, Animation laufen lassen:
  - Messung: Canvas-Ring um den MCH-Ausschnitt zeigt sanfte Farbübergänge, kein Springen zwischen Bändern mehr.
  - Prognose: ICON-CH1/CH2-Frames zeigen wieder weiche, „wettertypische" Verläufe statt harter Iso-Linien.
- Legende oben rechts listet die Stufen 0.2 / 1 / 2 / 4 / 6 / 10 / 20 / 40 / 60 mm/h.

## Dateien

- `src/components/maps/radar-map.tsx`
