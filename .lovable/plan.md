# Prognose +24 h & flüssigere Animation

## 1. Prognosezeitraum auf 24 h reduzieren

`src/lib/radar.functions.ts`

- `forecastCutoff = now + 24 * 3600 * 1000` (statt 48 h).
- ICON-CH1 (minutely_15) deckt 0…+24 h vollständig ab → liefert wie gehabt alle 15-min-Frames bis zum Cutoff.
- ICON-CH2-Block (hourly, +33…+48 h) komplett entfernen — wird durch den 24-h-Cutoff überflüssig und vereinfacht den Übergang Messung → Prognose.
- Doc-Kommentar oben (Zeile 11–20) anpassen: nur noch ICON-CH1, Horizon +24 h.
- `RadarFrame.source`-Type: `"icon-ch2"` darf bleiben (keine Breaking-Change im Typ), wird aber faktisch nicht mehr erzeugt. `sourceLabel` in `radar-map.tsx` bleibt unverändert.
- Logging anpassen: `[radar] forecast: ch1=…` (kein `ch2` mehr).

Ergebnis: Timeline reicht ab Beginn der Messungs-Lookback (~−6 h) bis +24 h, kein Sprung mehr zwischen Minutely- und Hourly-Prognose.

## 2. Flüssigere Playback-Animation

`src/components/maps/radar-map.tsx`

### a) Cross-Fade auch für Messungs-PNGs

Aktuell wird nur zwischen Canvas-Forecast-Frames weichgeblendet (`blendNext`); PNG-Frames (echte MCH-Messung) wechseln hart. Für die Playback-Glättung:

- Zweites `<ImageOverlay>` für `nextFrame.precipUrl` mit `opacity = opacityVal * progress` über das aktuelle legen.
- Aktuelles Overlay opacity entsprechend von `opacityVal` auf `opacityVal * (1 - progress)` herunterfahren.
- Wirkt für Messung **und** Forecast — kein hartes Springen mehr beim Frame-Wechsel.

### b) Playback-Tempo angleichen

- `FRAME_MS` von `600/speed` auf `750/speed` (15-min-Frame langsamer = weniger ruckelig in der Wahrnehmung; Cross-Fade hat mehr Zeit zu wirken).
- Speed-Default bleibt `1×`.

### c) Slider/Bubble-Update entkoppeln (optional, gering)

- Slider-Position folgt schon `progress` glatt; nichts zu tun.

## Nicht im Umfang

- Farbskala, Ingest, MCH-Sync bleiben wie nach dem v17-Reset.
- Schnee/Hagel-Layer unverändert.
- Keine Änderung an Cron, R2, Ingest-Workflow.

## Dateien

- `src/lib/radar.functions.ts` — `forecastCutoff`, ICON-CH2-Block entfernen, Doc.
- `src/components/maps/radar-map.tsx` — `FRAME_MS`, PNG-Cross-Fade über zweites `ImageOverlay`.
