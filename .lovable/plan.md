## Diagnose

Auf `/karten/radar` liefert `getRadarFrames` in der Preview-Umgebung eine leere Framesliste zurück, mit der Warnung:

```
Radardaten nicht verfügbar: Open-Meteo-Cache temporär nicht verfügbar;
MCH-Radarmessungen temporär nicht verfügbar;
Prognose-PNGs (ICON-CH1) temporär nicht verfügbar
```

Ursache steht in den Dev-Server-Logs:

```
[radar] no R2 radar manifest URL configured — falling back to model data only
```

`src/lib/radar.functions.ts` und `src/lib/openmeteo-cache.server.ts` bauen ihre R2-URLs aus `process.env.RADAR_MANIFEST_URL` / `RADAR_R2_PUBLIC_URL` / `R2_PUBLIC_URL`. In `.env` ist aber **keine** dieser Variablen gesetzt — deshalb liefert `r2ObjectUrlCandidates(...)` ein leeres Array, jeder Fetch entfällt und alle drei Quellen (Open-Meteo-Cache, Radar-Manifest, Forecast-Manifest) fallen weg → 0 Frames → "keine Daten".

Der Debug-Endpoint bestätigt, dass auf der veröffentlichten Umgebung dieselbe Variable auf
`https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev`
zeigt und der R2-Bucket alle Daten (Cache v5, Manifest v23-class-clean, 72 Frames, aktueller Precip-Frame 12:25Z) korrekt bereitstellt. Die Datenpipeline ist also gesund — es fehlt nur die Env-Konfiguration im lokalen/Preview-Build.

## Fix

Eine einzige Zeile in `.env` ergänzen (identisch zum Wert aus der Live-Umgebung):

```
R2_PUBLIC_URL="https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev"
```

Damit finden `radar.functions.ts`, `openmeteo-cache.server.ts` und der Debug-/Proxy-Pfad denselben Bucket wie die Produktion; `r2ObjectUrlCandidates` liefert wieder Kandidaten für `radar/frames.json`, `radar/forecast-frames.json` und `openmeteo/forecast.json`.

## Was NICHT geändert wird

- Keine Änderung an `radar.functions.ts`, `r2-url.server.ts`, `radar-map.tsx`, den Ingest-Skripten oder den Farb-/Form-/Kontur-Einstellungen.
- Kein Crossfade, kein Blur, keine Glättung — die Artefakt-Bereinigung aus `v23-class-clean` bleibt unangetastet.
- Keine Neuerzeugung von PNGs.

## Verifikation

1. Preview neu laden → Server-Fn `getRadarFrames` gibt Frames statt `[]` zurück, Warnung verschwindet.
2. Dev-Server-Log zeigt `[radar] manifest loaded from … 72 frames` statt "no R2 radar manifest URL configured".
3. Karte zeigt die vom Cronjob erzeugten sauberen (v23) PNGs.
