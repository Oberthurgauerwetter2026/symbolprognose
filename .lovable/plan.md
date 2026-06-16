## Ziel
Windanimation auf denselben deterministischen Stack wie der Niederschlagsradar
bringen: **ICON-CH1 hourly** für +0…+33 h, danach **nahtlos ICON-CH2 hourly**
bis +48 h. Heute liefert `phase1` (CH1 minutely_15) nur Niederschlag — der
Wind kommt komplett aus `phase2` (CH2), also faktisch CH2-only statt CH1→CH2.

## Änderungen

### 1. `scripts/ingest_openmeteo.py` — `phase1` um CH1-Wind erweitern
`p1` zusätzlich `hourly` mit Wind-Feldern (CH1 deckt ~+33 h ab):

```python
p1 = {
    "minutely_15": "precipitation,snowfall",
    "past_minutely_15": 48,
    "forecast_minutely_15": 132,
    "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    "past_hours": 12,
    "forecast_hours": 33,
    "timezone": "UTC",
    "models": "meteoswiss_icon_ch1",
}
```

Kommentar anpassen: „minutely_15 für Radar, hourly Wind für nahtlose
CH1→CH2-Verkettung der Windanimation".

`VERSION` von `oberthurgau-openmeteo-cache-v3-arome` auf
`oberthurgau-openmeteo-cache-v4-ch1-wind` heben — erzwingt frischen Ingest mit
den neuen Feldern.

### 2. `src/lib/wind.functions.ts` — CH1 zuerst, CH2 lückenlos anschliessend
Die vorhandene Lookup-Reihenfolge (`phase1` vor `phase2`) wird produktive
Hauptlogik:

- Header-Kommentar (Z. 5–13) umschreiben: „ICON-CH1 hourly (`phase1`) für
  +0…+33 h, danach nahtlos ICON-CH2 hourly (`phase2`) bis +48 h. Kein
  icon_seamless mehr — Übergang ist deterministisch auf den
  MeteoSchweiz-CH-Stack festgenagelt."
- Diagnose-Log erweitern:
  `console.info('[wind] CH1: ${ch1Used} h, CH2: ${ch2Used} h')`
- Keine API-/Payload-Änderung. `WindFrame`/`WindPayload` bleiben gleich,
  `wind-map.tsx` und Embed unverändert.

## Was sich nicht ändert
- BBox, Grid, Frame-Format, Frontend, Embed-Route.
- `phaseA`/`phaseC` — unverändert.

## Verifikation nach nächstem Ingest
- `phase1[0].hourly` enthält `wind_speed_10m/direction/gusts` mit ~46
  Zeitstempeln (–12…+33 h).
- Server-Log: `[wind] CH1: ~33 h, CH2: ~15 h`.
- `/karten/wind` — kein Sprung in Stärke/Richtung zwischen Stunde +33 und +34.