## Ziel

In der Radar-Karte sollen die **Prognose-Frames** (ICON-CH1/CH2, nicht das echte MeteoSchweiz-Radar) deutlich transparenter dargestellt werden, damit die Reliefschattierung darunter besser sichtbar bleibt. Echte Radar-Frames (Vergangenheit/Jetzt) bleiben unverändert kräftig.

## Änderung in `src/components/maps/radar-map.tsx`

Im Block ab Zeile ~973 (`{data && currentFrame && (() => { ... })()` ):

- Neue Konstante direkt vor `return`:
  ```ts
  const FORECAST_OPACITY_MULT = 0.65; // Prognose halbtransparent → Relief sichtbar
  const isForecast = currentFrame.source !== "radar";
  const opacityVal = Math.max(0, Math.min(1,
    (currentFrame.blendOpacity ?? 1) * (isForecast ? FORECAST_OPACITY_MULT : 1)
  ));
  ```
- `opacityVal` wird unverändert weiter an `PrecipOverlay` und `ImageOverlay` durchgereicht.

Effekt:
- **Radar-Frames** (`source === "radar"`, PNG via ImageOverlay): unverändert (Faktor 1).
- **Prognose-Frames** (`source === "icon-ch1"`/`"icon-ch2"`, Canvas via PrecipOverlay): Opazität ×0.65, sodass die swisstopo-Reliefschattierung (Layer-Opacity 0.55) klar durchscheint.
- Soft-Blending zwischen Nowcast und Prognose (`blendOpacity` aus Cross-Fade) bleibt erhalten, weil der Faktor multiplikativ ist.

## Nicht angefasst

- Farbskala (`colorFor`/`snowColorFor`), Sharpening (SHARP=7), Grid-Sampling.
- Reliefschattierungs-Layer (bleibt bei opacity 0.55).
- Masken, Seen, THURGAU/SWITZERLAND/REGION_OUTLINE-Layer.
- Zoom-Defaults (9.5 / snap 0.5), Timeline, Hagel, Schnee.

## Validierung

- Im Prognosezeitraum: Reliefkonturen (Alpenkamm, Bodensee-Umfeld) durch die Niederschlagsbänder klar erkennbar; Bänder behalten Farbe und scharfe Kanten, wirken aber „weicher".
- Im Radarzeitraum (Vergangenheit/Jetzt): keine sichtbare Veränderung gegenüber jetzt.
- Beim Cross-Fade Nowcast↔Prognose kein Sprung in der Opazität (Multiplikation greift kontinuierlich).

## Optional (falls 0.65 zu schwach/zu stark wirkt)

Wert `FORECAST_OPACITY_MULT` zwischen `0.55` (sehr transparent, Relief dominant) und `0.8` (Niederschlag dominant) feinjustieren — eine Zahl, sofort tunbar.
