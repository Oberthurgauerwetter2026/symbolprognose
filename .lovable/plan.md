# Quellen-Texte auf ICON-seamless anpassen

Nach dem Modell-Wechsel zeigen mehrere UI-Stellen und Code-Kommentare noch „ICON-CH1/CH2". Diese werden auf den neuen Datenfluss aktualisiert.

## Aktueller Datenfluss (zur Erinnerung)

- **Symbol-/Lokalprognose**: `icon_seamless` (Primär) + IFS-EPS (Fallback) + MOSMIX (Tag 6+) + best_match (Restfelder)
- **Windprognose-Karte**: `icon_seamless` hourly (aus `phase2`)
- **Radar-Karte**: MeteoSchweiz CombiPrecip (Messung) + ICON-CH1 `minutely_15` (Nowcast) + `icon_seamless` hourly (ab +6 h, aus `phase2`)
- **Niederschlagssummen-Karte**: gleiche Quellen wie Radar

## Sichtbare UI-Texte

### `src/components/weather-widget.tsx`
- Zeile 350 (Tooltip): `"ICON-CH1/CH2, ECMWF IFS, DWD-MOSMIX"` → `"ICON-seamless, ECMWF IFS, DWD-MOSMIX"`
- Zeile 354 (Footer-Stempel): gleiche Ersetzung.
- Zeile 1166 (Footer Datenherkunft): `"MeteoSchweiz ICON-CH1-EPS/ICON-CH2-EPS · Tag 6–7: ECMWF IFS Ensemble · Rest: Open-Meteo best_match …"` → `"MeteoSchweiz ICON-seamless · Tag 6–7: DWD-MOSMIX + ECMWF IFS Ensemble · Rest: Open-Meteo best_match …"`

### `src/routes/karten.lokal.tsx`
- Zeile 24 (meta description): „… mit Modelldaten von MeteoSchweiz (ICON-CH2)." → „… mit Modelldaten von MeteoSchweiz (ICON-seamless)."
- Zeile 37 (subtitle): `"5-Tage-Prognose · ICON-CH1/CH2 · ECMWF IFS"` → `"5-Tage-Prognose · ICON-seamless · ECMWF IFS"`

### `src/routes/karten.niederschlag.tsx`
- Zeile 65: „… auf Basis von ICON-CH1 (bis +33 h, 1 km) und ICON-CH2 (bis +120 h, 2 km) via Open-Meteo." → „… auf Basis von **ICON-seamless** (CH1 1 km · CH2 2 km · ICON-EU/global 6–13 km, bis +168 h) via Open-Meteo."

### `src/lib/maps-config.ts`
- Zeile 47 (Wind): „Animierte Windböen aus ICON-CH1 …" → „Animierte Windböen aus ICON-seamless …"
- Zeile 57 (Radar): „… Nowcast und ICON-CH1 Vorhersage bis +24 h." bleibt — die Nowcast-Schiene ist tatsächlich noch CH1 `minutely_15`. Anpassen auf: „… Nowcast aus ICON-CH1 (15-min) und ICON-seamless Vorhersage bis +48 h."

## Admin-Übersicht

### `src/routes/admin.tsx` (Zeilen 117–167)
- Zwei Einträge **ICON-CH1-EPS** und **ICON-CH2-EPS** durch **einen** neuen Eintrag **ICON-seamless** ersetzen:
  - `provider: "MeteoSchweiz via Open-Meteo Forecast-API"`
  - `resolution: "1 km (0–33 h) → 2 km (bis 120 h) → 6–13 km (bis 168 h)"`
  - `members: "— (deterministisch)"`
  - `range: "bis 168 h"`
  - `usage: "Tag 1–7 Primärquelle (hourly)"`
  - `endpoint: "https://api.open-meteo.com/v1/forecast?models=icon_seamless"`
- **Zusätzlicher** Eintrag **ICON-CH1 (minutely_15)** für Radar-Nowcast:
  - `provider: "MeteoSchweiz via Open-Meteo Forecast-API"`, `resolution: "1 km"`, `members: "—"`, `range: "−12 h … +33 h, 15-min"`, `usage: "Radar-Nowcast & Niederschlagskarten"`, `endpoint: ".../forecast?models=meteoswiss_icon_ch1&minutely_15=..."`.
- Zeile 206 (Merge-Reihenfolge): `CH1 → CH2 → MOSMIX (ab Tag 6) → IFS → best_match` → `icon_seamless → MOSMIX (ab Tag 6) → IFS-EPS → best_match`. Begleittext anpassen (keine Ensemble-Mittelung mehr für Primärquelle; IFS-EPS bleibt als Ensemble-Fallback).

## Code-Kommentare

### `src/lib/weather.ts`
- Zeile 1: `// Open-Meteo client-side fetchers (ICON-CH2 / MeteoSchweiz model).` → `// Open-Meteo client-side fetchers (ICON-seamless / MeteoSchweiz model).`

### `src/lib/wind.functions.ts`
- Header-Kommentar (Zeilen 5–13): Beschreibung umschreiben — `phase1` enthält keine Wind-Hourly-Daten mehr, `phase2` liefert nun `icon_seamless` als alleinige Quelle. Fallback-Logik bleibt im Code (defensiv), wird aber als „CH1 (legacy phase1) → icon_seamless (phase2)" dokumentiert.
- Kommentare in `buildTimeIndex` (Zeile 77) und `readHour` (Zeile 93): `CH1/CH2` → `phase1/phase2 (icon_seamless)`.
- Log-Zeile 165: `"[wind] CH2-Fallback für …"` → `"[wind] icon_seamless (phase2) für …"`.

### `src/lib/radar.functions.ts`
- Header-Kommentare (Zeilen 7–15) und Inline-Block (Zeilen 337–343): „CH2 hourly" → „icon_seamless hourly (phase2)". CH1 minutely_15 bleibt namentlich erhalten (ist real CH1).
- Log-Zeile 495: `ch1=${ch1Count} ch2=${ch2Count}` → `ch1Minutely=${ch1Count} iconSeamless=${ch2Count}`.

### `src/routes/api/public/openmeteo/ingest-trigger.ts`
- Zeile 8: Kommentar „… die ICON-CH1 minutely_15 Daten liest." bleibt korrekt (Nowcast-Schiene). Keine Änderung nötig.

## Nicht angepasst (bewusst)

- **`radar.functions.ts` Source-Enum** (`"icon-ch1" | "icon-ch2"`): bleibt als API-Vertrag zum Radar-Map-Client erhalten. Funktional ist `"icon-ch1"` weiterhin CH1 minutely_15, `"icon-ch2"` repräsentiert jetzt den `icon_seamless`-Hourly-Fallback. Umbenennen würde den Client (`radar-map.tsx`) brechen und ist außerhalb dieses Scopes.
- **`snapshot.server.ts`** (CH1 für Snapshot-Rendering): eigenständiger Use-Case, bleibt CH1.
- **Wind-/Radar-Logik**: rein textuelle Änderungen; Datenfluss bleibt unverändert.
