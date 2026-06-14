## Ziel

Wind- und Niederschlagsradar-Animation zeigen Modellprognose bis **+48 h** (statt aktuell +24 h). ICON-CH1 bleibt die primäre Quelle solange sie Daten liefert; **ICON-CH2** füllt nahtlos die Stunden, in denen CH1 keine Werte (mehr) hat — kein Bruch in der Timeline, keine Lücken, kein Quellen-Sprung sichtbar.

## Hintergrund

- ICON-CH1 liefert in `phase1` heute hourly precip + wind bis +120 h und minutely_15 bis +33 h. Theoretisch reicht das für 48 h.
- In der Praxis hat CH1 aber regelmässig **am Anfang oder Ende des Run-Zyklus Lücken** (Run-Verzögerung, Modellausfall) — genau dort soll CH2 als Fallback einspringen.
- Heute steht im Cache `phase2: []`. Wir reaktivieren phase2 als echten **ICON-CH2-Fetch** (stündlich, 10 m Wind + Niederschlag, ~+0…+120 h).
- `radar.functions.ts` hat bereits einen `extended`-Pfad mit Tag `icon-ch2`, der aber faktisch CH1-Hourly liefert. Das wird korrigiert.

## Änderungen

### 1) Ingest erweitern (`scripts/ingest_openmeteo.py`)
- Neue Phase **`phase2`** (ICON-CH2 hourly, ~+0…+120 h):
  - `hourly = "precipitation,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m"`
  - `past_hours = 6`, `forecast_hours = 120`
  - `models = "meteoswiss_icon_ch2"`
  - Gleicher 36×22-Grid, gleicher chunk_fetch-Pfad, optional + Fallback auf prev-Cache
- `payload["phase2"] = phase2` (statt `[]`). `phase1` bleibt unverändert.

### 2) Cache-Layer (`src/lib/openmeteo-cache.server.ts`)
- `phase2` ist bereits typisiert — nichts zu tun. Sicherstellen, dass merge die Phase nicht verliert.

### 3) Radar-Serverfunktion (`src/lib/radar.functions.ts`)
- `forecastHorizonH` für **nicht-extended** auf **48** anheben (war 24). Der `extended`-Modus für Niederschlagssummen bleibt bei 48 (bzw. wird wie heute weiter genutzt).
- Prognose-Frame-Erzeugung pro voller Stunde `tMs ∈ (now, now+48 h]`:
  1. Versuche **CH1-Quelle**: bevorzugt minutely_15 :00-Sample, ansonsten CH1-hourly (`r1[pi].hourly.precipitation/snowfall`).
  2. Falls für diese Stunde **keine** brauchbaren CH1-Werte vorhanden sind (`time`-Index fehlt oder alle Punkte `null`/undefined) → nimm denselben Zeitstempel aus **`phase2` (echt ICON-CH2)**.
  3. Tag korrekt setzen: `source: "icon-ch1"` resp. `"icon-ch2"`. `sourceT = tIso`.
- Bias-Korrektur unverändert für CH1; auf CH2-Fallback-Frames **kein** Bias anwenden (CH2 hat eigene Skalierung).
- Schnee analog (`snowfall` aus CH1 mit CH2-Fallback).

### 4) Wind-Serverfunktion (`src/lib/wind.functions.ts`)
- `FORECAST_HOURS = 48`.
- Pro Stunde `tMs` im Fenster `[startMs, now+48 h]`:
  1. Lies `wind_speed_10m / wind_direction_10m / wind_gusts_10m` aus CH1-Hourly.
  2. Wenn **alle drei Felder** für diese Stunde fehlen oder durchgängig `null` sind → Fallback auf **`phase2`** (CH2-Hourly), gleicher Zeitstempel.
  3. Frame mit `t`, `gust`, `speed`, `dir` schreiben — keine Quellen-Markierung nach aussen nötig (UI zeigt nur eine Timeline).
- Frame-Reihenfolge bleibt stündlich aufsteigend, ohne Doppel-/Leerframes.

### 5) Radar-UI (`src/components/maps/radar-map.tsx`)
- Frame-Cap entfernen / auf **+48 h** heben (heute `cutoff = now + 24h` + Filter `source !== "icon-ch2"`). Beide Bedingungen werden gelockert, sodass CH1+CH2 Prognoseframes bis +48 h durchlaufen.
- Quellen-Footer-Text: „MeteoSchweiz ICON-CH1, nahtlos ergänzt durch ICON-CH2 (Vorhersage bis +48 h)".

### 6) Wind-UI (`src/components/maps/wind-map.tsx`)
- Falls dort ein 24-h-Cap existiert (in der Timeline-/Slider-Logik), auf 48 h erweitern. Footer-Text analog: „ICON-CH1 + ICON-CH2, +0 … +48 h".

## Out of Scope

- Niederschlagssummen-Seite (`karten.niederschlag`) — nutzt bereits `extended: true` und wird durch die korrigierte Quellen-Tagging-Logik automatisch sauberer (CH2 nur dort, wo es real CH2 ist).
- Keine UI-Anzeige der Quelle pro Frame; der Übergang soll bewusst unsichtbar bleiben.

## Technische Hinweise

- Der erste echte CH2-Frame ist im UI erst sichtbar, **nachdem** der nächste Ingest-Run gelaufen ist (GitHub Action `openmeteo-ingest`). Bis dahin füllt CH1-Hourly die +24…+48-Stunden, was zwar funktioniert, aber den eigentlichen Sinn der Erweiterung nicht ausschöpft.
- `phase2` ist optional: wenn der CH2-Fetch fehlschlägt, fällt der Cache auf den vorherigen `phase2` zurück; ist auch der leer, läuft die Prognose mit reinen CH1-Hourly-Werten weiter (statt zu brechen).
- Grid bleibt identisch (BBOX + 36×22), damit keine Resampling-Logik nötig ist.
