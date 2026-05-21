## Änderungen — `src/components/region-map.tsx`

### 1. "Stündliche Ansicht"-Toggle in die Tagesleiste verschieben

- Den Button aus dem Slider-Header entfernen.
- Direkt **links** vor den 7 Wochentag-Buttons als eigener Pill-Button platzieren (gleiche Pill-Leiste, gleiche Höhe). Beschriftung deutlich: Icon (Uhr 🕐 als Inline-SVG) + Text "Stündlich".
- Aktiv (= `viewMode === "hourly"`) → BRAND-Hintergrund, weißer Text (wie aktiver Wochentag). Inaktiv → neutral.
- Klick:
  - Wenn `viewMode === "daily"` → Slider auf Tagesanfang des `selectedDayIdx` setzen, `setViewMode("hourly")`.
  - Wenn schon hourly → keine Aktion (oder: setzt `stepOffset = 0` / "jetzt"). Wir nehmen: setzt auf "jetzt" (`stepOffset = 0`) für Klarheit.
- Im Slider-Header bleibt nur Wochentag-Label + Stunden-Pill bzw. "Tagesübersicht"-Label.

### 2. Marker grösser / lesbarer

In `MarkerPill`:
- Ortsname: `fontSize: 14 → 17`, `letterSpacing` leicht erhöhen.
- Temperatur-Chips: `fontSize: 12 → 14`, Padding `2px 8px → 3px 10px`.
- Icon-Kreis: `46 → 52`, Icon `34 → 40`.
- Pill-Padding: `8px 14px 8px 8px → 10px 16px 10px 10px`, gap `10 → 12`.
- `iconSize` von `[200, 64]` auf `[230, 76]`, `iconAnchor` entsprechend `[115, 38]`.

### 3. Stärker zoomen als Standard

- `MapContainer`: `bounds` durch `center` + `zoom` ersetzen, z.B. Zentrum der Region und `zoom={11}` (statt fit-bounds bei ~10).
- Konkret: berechnetes Center aus REGION-Bounds nehmen, `zoom={11}`. `maxBounds` bleibt.
- Falls Center-Berechnung nicht reicht: `boundsOptions.padding` von `[8,8]` auf negativ wirkenden Wert ändern ist nicht möglich; deshalb explizit `center`/`zoom` setzen.

## Nicht betroffen

Tag-/Nacht-Logik, Marker-Klick-Navigation, Layer, Wochentag-Buttons-Verhalten (Klick → daily-Modus).
