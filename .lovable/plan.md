## Ziel

Den AROME-HD-String aus der Multi-Modell-Aggregation der Symbolprognose entfernen. Die Radar-/Niederschlags-Komponenten (AROME-HD-Overlay) bleiben unangetastet.

## Änderung

**Datei:** `src/lib/forecast-aggregated.functions.ts`

In `CACHE_MODEL_SUFFIXES` (Zeile 35–42) den Eintrag `"meteofrance_arome_france_hd",` entfernen. Die übrigen Modelle (ICON-CH2, ICON-D2, ARPEGE-Europe, ECMWF-IFS, GFS) bleiben.

```ts
const CACHE_MODEL_SUFFIXES = [
  "meteoswiss_icon_ch2",
  "icon_d2",
  "arpege_europe",
  "ecmwf_ifs025",
  "gfs_global",
] as const;
```

## Nicht betroffen

- `src/lib/arome-cache.server.ts`, `src/lib/arome-dispatch.server.ts`, `src/routes/api/public/arome/ingest-trigger.ts` — diese liefern das AROME-HD-Niederschlags-Overlay für den Radar und sind nicht Teil der Symbolprognose.

## Verifikation

Symbolprognose-Aufruf auf `/karten/region` und im Wetter-Widget kurz prüfen — Stundenwerte / Tages-Symbole müssen weiterhin gefüllt sein (Fallback über ICON-CH2 / ICON-D2 / ECMWF / GFS).
