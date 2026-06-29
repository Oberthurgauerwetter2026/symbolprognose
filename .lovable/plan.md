## Ziel

1. Prognose-Frames bewegen sich wieder ehrlich im 15-min-Takt aus den ICON-CH1 `minutely_15`-Werten — ohne Wind-Drift-Workaround.
2. Filmstrip-Panel wird horizontal schmaler dargestellt (mehr Karte sichtbar).
3. Wochentag/Datum im Steuer-Panel unter dem Filmstrip wird entfernt.
4. Messung: das Smoothing (wässrig machen) deutlicher reduzieren, ohne wieder Quadrate oder ähnliche szu erzeugen

## Änderungen

### 1) `src/lib/radar.functions.ts` — echte 15-min-Werte aus ICON-CH1

- `inputValidator`: Feld `drift` entfernen (war Workaround).
- Phase-A-Loop (ab Zeile ~666) vereinfachen auf
`const grid = getForecastExact(tMs) ?? interpolateForecast(tMs);`
Damit liefert jeder 15-min-Frame direkt den `minutely_15`-Wert aus `r1` (siehe `readForecastExact`, Zeilen 434-458, wo `min15Idx` alle Viertelstunden-Slots indexiert — nicht nur `:00`).
- `interpolateForecast` nur noch als Lücken-Fallback (z. B. wenn CH1 ausfällt), nicht als Glättung über echte 15-min-Slots.
- Diagnostik-Log umstellen: statt mittlere Wind-Komponente eine Probe der ersten 6 h Prognose loggen — pro `:00/:15/:30/:45` die mittlere `precip`-Intensität (`mm/h`), damit verifizierbar ist, dass die Werte zwischen den Viertelstunden tatsächlich variieren (`[radar] forecast 15-min sample: 17:00=0.4 17:15=0.7 17:30=0.9 17:45=1.1 …`).
- `ADVECT_SCALE`, `meanWindAt`, `advectField`, `advectedForecast` bleiben unangetastet bestehen (werden in dieser Schiene nicht mehr aufgerufen, evtl. später erneut benötigt) — keine Aufräum-Arbeit am toten Code in diesem Schritt, um die Diff klein zu halten.

### 2) `src/components/maps/radar-map.tsx` — Drift-Toggle weg + UI-Slimming

- `driftOn`-State + `Switch` „Wind-Drift (Prognose)" im Settings-Popover entfernen (Zeilen 1673, 2217-2231).
- `useQuery`-Aufruf vereinfachen auf festen `queryKey: ["radar-frames"]`, `queryFn: () => getRadarFrames()`, `initialData: initialFrames`.
- Im Steuer-Panel (Zeilen 2054-2059) im Nicht-`bare`-Fall die Breite begrenzen, z. B. `mx-auto w-full max-w-3xl`. Bare-Mode bleibt unverändert (Overlay über die ganze Karte).
- In `FilmstripTimeline`:
  - `dayLabel`-Block (Zeilen 1651-1654) komplett entfernen.
  - `fmtDayLong` ist dann ungenutzt → löschen.

### Verifikation

- `bunx tsgo --noEmit` muss grün sein.
- Im Preview `/karten/radar`:
  - Console-Log zeigt unterschiedliche `precip`-Werte für `:00/:15/:30/:45` der nächsten Stunden (kein Plateau).
  - Filmstrip-Panel deutlich schmaler als die Karte, zentriert; Karte besser sichtbar.
  - Unter dem Filmstreifen kein „Mo, 30.06.2026"-Label mehr; nur die Bubble oben zeigt weiterhin Wochentag + Uhrzeit (gewünscht).