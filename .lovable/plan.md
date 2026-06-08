## Ziel

Die Radar-Modellprognose endet wieder klar bei **+24 h (ICON-CH1)**. ICON-CH2 wird ausschliesslich für die Niederschlagssummen ausgeliefert — nicht mehr im Client gefiltert, sondern direkt vom Server gesteuert. Die Quellenangabe im Radar wird entsprechend angepasst.

## Änderungen

### 1) `src/lib/radar.functions.ts` — CH2 nur auf Anforderung

- `getRadarFrames` erhält einen `inputValidator`, der ein optionales Objekt akzeptiert:
  ```ts
  .inputValidator((data?: { extended?: boolean }) => ({
    extended: data?.extended === true,
  }))
  ```
- Der ICON-CH2-Block (aktuell ab Zeile ~373, `ref1Hourly`-Loop) wird in `if (data.extended) { … }` gewrappt. Ohne `extended` werden keine `icon-ch2`-Frames mehr emittiert; mit `extended: true` bleibt das bisherige Verhalten (Stundenframes bis +48 h, Bias-Korrektur identisch).
- `ch2Count`-Log nur ausgeben, wenn `extended` aktiv ist.

### 2) `src/components/maps/radar-map.tsx` — Client-Filter raus

- Zeile 931: Filter entfernen → `const frames = data?.frames ?? [];` (Server liefert ohnehin nur noch CH1).
- Zeile 1379: Footer-Text korrigieren:
  ```
  · MeteoSchweiz ICON-CH1 (Vorhersage bis +24 h)
  ```

### 3) `src/routes/karten.niederschlag.tsx` — Extended anfordern

- `queryFn: () => getRadarFrames({ data: { extended: true } })`
- `queryKey: ["radar-frames-accum", "extended"]` (kein Cache-Konflikt mit Radar).

### 4) `src/routes/karten.radar.tsx` & Radar-Map-Query

- Aufrufe bleiben parameterlos (`getRadarFrames()`), Query-Key `["radar-frames"]` unverändert → Standard-Antwort ohne CH2.

### 5) Verifikation

- `/karten/radar`: Timeline endet bei +24 h, Footer zeigt „ICON-CH1 (Vorhersage bis +24 h)", Server-Log `[radar] forecast: ch1=N` (ohne ch2).
- `/karten/niederschlag`: 12-/24-/48-h-Karten unverändert, 48 h > 24 h, Server-Log `[radar] forecast: ch1=N ch2=M`.
- Payload `/karten/radar` ist messbar kleiner (kein zweiter Stundensatz).
