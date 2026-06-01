## Ziel

Prognose-Frames hybrid emittieren: **15-min-Takt für die ersten 6 h**, danach **stündlich** bis +24 h. Bias-Korrektur, Snow-Handling und Client-Advektion bleiben unverändert.

## Änderung (1 Datei, 1 Block)

`src/lib/radar.functions.ts`, ab Zeile 318 (`if (ref1 && r1) { ... }`).

### Logik

Filterkriterium pro `ti`:
- Innerhalb der ersten 6 h ab `now`: **alle 15-min-Samples** verwenden (`:00`, `:15`, `:30`, `:45`).
- Nach 6 h: nur noch `:00`-Samples (wie bisher).
- Cutoff oben (`forecastCutoff`, +24 h) unverändert.

Konkret in der bestehenden Schleife `for (let ti = 0; ti < ref1.time.length; ti++)`:

```text
const tIso = ref1.time[ti];
const tMs = Date.parse(tIso + "Z");
if (tMs <= now) continue;
if (tMs > forecastCutoff) continue;
const dtMinFromNow = (tMs - now) / 60_000;
const inNowcast = dtMinFromNow <= 360;          // 6 h
const isHourly = tIso.endsWith(":00");
if (!inNowcast && !isHourly) continue;          // ausserhalb Nowcast nur volle Stunden
```

`dtMinFromNow` wird ohnehin schon für die Bias-Fade-Gewichtung berechnet — Berechnung einmal teilen.

### Korrekt-Anzeige der „echten" Stützstellen

Nur volle Stunden (`:00`) sind native ICON-CH1-Werte. Die `:15`/`:30`/`:45`-Samples sind Open-Meteo-Interpolationen. Damit die UI das nicht als gleich-präzise Modellfelder verkauft, das `RadarFrame` um ein optionales Flag erweitern:

- In `radar.functions.ts`:
  ```text
  frames.push({
    t: tIso + "Z",
    source: "icon-ch1",
    values: precip,
    snowValues: snow,
    interpolated: inNowcast && !isHourly,   // neu
  });
  ```
- Im `RadarFrame`-Typ (gleiche Datei oder zentral, wo immer er deklariert ist) `interpolated?: boolean` ergänzen.
- Keine UI-Änderungen in diesem Plan — Flag steht bereit für späteren Tooltip-Hinweis, falls gewünscht. (Optisch ist die Animation durch Advektion + Crossfade ohnehin stetig.)

### Payload-Folgen

- Stündlich heute: ~24 Frames × nPts.
- Hybrid: 6 h × 4 + 18 = **42 Frames** statt 24 → ~+75 % Manifest-Grösse.
- Kein Snow-Decode-Mehraufwand pro Frame, da `nPts` identisch.

### Was nicht angefasst wird

- `radar-map.tsx` (Client-Rendering, Advektion, Player-UI): unverändert. Mehr Frames → mehr Slider-Stops, das ist von Haus aus mitskaliert.
- Bias-Korrektur-Block (Zeilen 271–316): unverändert.
- Messpfad (PNG-Frames): unverändert.
- `forecast.functions.ts` / Embed-Loader: keine Änderung nötig (lesen anderen Endpoint).

## Out of Scope

- UI-Hinweis „interpoliert" — Flag wird vorbereitet, aber nicht gerendert.
- Echter Nowcast aus AROME/INCA — separater Vorschlag, falls später gewünscht.
- Player-Speed-Anpassung an grössere Frame-Zahl.
