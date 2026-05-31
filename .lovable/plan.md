## Ziel

Die Radarkarte zeigt nur noch zwei klar getrennte Quellen — wie bei MeteoSchweiz / DWD:

1. **Messung** = echte MeteoSchweiz-CombiPrecip-PNGs aus R2 (Vergangenheit, bis „jetzt").
2. **Prognose** = ICON-CH1 (15-min, +0…+33 h) und ICON-CH2 (stündlich, +33…+48 h), direkt aus dem ICON-Lauf, ohne Re-Sampling, ohne Wind-Advection-Glättung.

Die ganze „Zellverlagerung" / Nowcast-Pipeline fliegt komplett raus.

## Änderungen

### 1. `src/lib/radar.functions.ts` — Nowcast & Wind-Advection löschen

Folgende Blöcke ersatzlos entfernen:

- **Nowcast-Block** (`---- Nowcast (Radar-Extrapolation, T+0…+90 min) ----`, ca. Zeilen 424–659): alle Berechnungen rund um `motion`, `nowcastMotion`, Optical-Flow-Feld, Wind-Fallback und das Pushen von `source: "nowcast"`-Frames.
- **Soft-Blending-Marker** für ICON-CH1 (`overlapStartMs`, `blendOpacity`-Berechnung in der CH1-Schleife, ca. Zeilen 660–746) — ICON-CH1-Frames werden ab `now` direkt mit voller Opazität geliefert.
- **15-min-Smoothing via Wind-Advection** (`meanWindAt`, `sample`, `shiftField`, `advectPair`, ca. Zeilen 786–944).
- **Self-Test** `assertWindMotionSign()` (Zeilen 36–64) — wird ohne Nowcast nicht mehr gebraucht.
- Aus `RadarFrame`: `imageOffset`, `motionSource`, `motionTiles`, `blendOpacity` entfernen (nicht mehr genutzt).
- Aus `RadarPayload`: `motion` entfernen.
- `getRadarFrames` liefert nur: gemessene Radar-Frames (PNG-Overlays) + ICON-CH1 + ICON-CH2.

**Bias-Korrektur** (Zeilen 671–702): bleibt drin, ist seriös — bringt Messung und Prognose intensitätsmässig zusammen, ohne Geometrie zu verschieben. Fade-Fenster: 120 min (unverändert).

**Zeit-Konsistenz Messung:** Im Radar-Frame-Push (Zeile 411–421) garantieren, dass `t` immer dem echten `sourceT` entspricht. `FILL_LIMIT` steht schon auf 0; `isFilled` wird damit nie gesetzt — Feld kann aus dem Interface verschwinden. Damit zeigt die Bubble in der Timeline („Messung: Mo, 14:35") exakt den Zeitstempel des dargestellten PNG, ohne stille Forward-Fills.

### 2. `src/components/maps/radar-map.tsx` — Nowcast-UI entfernen

- `sourceLabel`: Zweig `frame.source === "nowcast"` löschen.
- `fmtBubble`: Sonderfall `nowcast` löschen.
- **Zugbahn-Pfeil-Overlay** (Zeilen 1056–1090) komplett entfernen.
- Im `currentFrame`/`ImageOverlay`-Block: `imageOffset`-Verschiebung der Bounds entfernen — Overlay liegt immer auf der nominalen `imageBbox`.
- `blendOpacity`-Logik im Overlay-Opacity-Berechnung entfernen. Statt einer Multiplikator-Akrobatik:
  - Messung (`source === "radar"`): `opacity = 1`.
  - Prognose (`icon-ch1` / `icon-ch2`): `opacity = 0.75` (statisch, damit Relief sichtbar bleibt — wie MeteoSchweiz „Voraussage").
- `frameMaxMmh`-Toter-Code & `void frameMaxMmh` entfernen.

**Quellen-Badge / Footer-Text:** „MeteoSchweiz Radar (Messung) · ICON-CH1/CH2 (Vorhersage bis +48 h)" — bleibt, nur ohne Nowcast-Erwähnung.

### 3. Farbskala — Standard-NS-Stufen

`SCALE` in `radar-map.tsx` ersetzen durch die übliche MeteoSchweiz-/DWD-Stufung mit zugehörigen Intensitäts-Bändern (mm/h, Farbcode wie auf den offiziellen Karten):

```text
 0.1  hellblau    (sehr leichter Niederschlag)
 0.3  blau        (leichter Niederschlag)
 1.0  dunkelblau
 3.0  grün
10.0  gelb        (mässiger Niederschlag)
30.0  orange      (starker Niederschlag)
50.0  rot         (sehr starker Niederschlag)
100   magenta     (extrem)
```

Hex-Werte werden so gewählt, dass sie der MeteoSchweiz-Legende auf <https://www.meteoschweiz.admin.ch/wetter/wetter-und-klima-aktuell/niederschlagsradar.html> entsprechen. Die Funktion `colorFor` bleibt strukturell gleich (quantisierte Bänder, keine Verläufe), nur die Tabelle ändert sich. Die Legende rechts oben übernimmt die neuen Stufen automatisch.

Schnee-Skala (`SNOW_SCALE`, „leicht / stark", lila) bleibt.

### 4. Zeit-Konsistenz Prognose

ICON-CH1 / CH2 werden ohne Advection-Smoothing 1:1 als 15-min-/Stunden-Frames durchgereicht. Der Zeitstempel jedes Frames entspricht damit exakt dem ICON-Validzeitpunkt. Übergang Messung → Prognose ist hart bei `now`: bis und mit letztem MCH-Frame Messung, danach ICON-CH1.

## Nicht Teil dieses Plans

- Workflow `Radar Ingest` und Cron-Worker bleiben unverändert.
- `scripts/ingest_radar.py` und das R2-Manifest bleiben unverändert; das `motion`-Feld im Manifest wird einfach ignoriert. Aufräumen im Python-Code kann später nachgezogen werden.
- Keine Änderung an Hagel-Layer (POH), Embed, Region-/Karten-Mask.

## Verifikation

- `/karten/radar` öffnen: Timeline endet bei echtem letztem MCH-Frame; ab dort beginnen ICON-CH1-Frames. Kein „Nowcast"-Label, kein Zugbahn-Pfeil mehr.
- Bubble-Zeit über dem Handle stimmt mit dem Quellen-Badge-Zeitstempel überein.
- Legende rechts oben zeigt die neuen mm/h-Stufen.
- Übergang Messung → Prognose ohne sprunghafte Intensitäts-Verfärbung (Bias-Korrektur greift die ersten ~2 h).

## Dateien

- `src/lib/radar.functions.ts`
- `src/components/maps/radar-map.tsx`
