## Änderungen in `src/components/region-map.tsx`

### 1. 7-Tagesprognose statt 5
- `MAX_STEPS = 40` → `MAX_STEPS = 56` (7 Tage × 8 × 3 h).
- Tagesleiste: `Array.from({ length: 6 })` → `Array.from({ length: 7 })`.
- `formatDayLabel`: bleibt (Heute/Morgen/Wochentag-Kurz), funktioniert für alle 7 Tage.
- Open-Meteo liefert bereits 7 Tage `daily` und 168 h `hourly` (siehe `src/lib/weather.ts`).

### 2. Moderner Zeit-Slider mit Stundenlegende
Ersetzt die bestehende schmale Slider-Box:

```text
┌─────────────────────────────────────────────────┐
│  Mittwoch · 12. Juni                  12:00     │  ← Kopfzeile (BRAND-Chip rechts)
│                                                 │
│   ●━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━━━━━━━━━━     │  ← dickerer Track (6 px), Thumb 18 px
│   │   │   │   │   │   │   │   │   │             │  ← dezente Ticks
│  00  03  06  09  12  15  18  21  00             │  ← Stunden-Legende (aktueller Tag)
└─────────────────────────────────────────────────┘
```

Details:
- Eigener Wrapper um den bestehenden Radix-Slider, Track 6 px, `BRAND/15` Hintergrund, `BRAND` Range, weißer Thumb 18 px mit `BRAND`-Ring + Schatten.
- **Stunden-Legende**: 9 Beschriftungen `00, 03, 06, 09, 12, 15, 18, 21, 00` für die 24 h ab Tagesanfang des aktiven Tages. Aktiver Tick fett + `BRAND`, übrige `muted-foreground`.
- Über den Labels eine Reihe dünner vertikaler Ticks (1 px × 6 px, `border` Farbe).
- Kopfzeile: aktiver Wochentag **lang** (`Mittwoch`) + Datum links, großer Stunden-Chip rechts.
- Unten weiterhin `jetzt` / `+7 Tage`-Footer.

### 3. Marker-Link nur bei explizitem Marker-Klick
- Aktuell: Klick auf das **Region-Polygon** navigiert zu `/`, Marker sind `interactive={false}`.
- Neu:
  - Marker werden klickbar: `interactive={true}`, `eventHandlers={{ click: goHome }}` auf `<Marker>`, Pill bekommt `cursor: pointer` + leichten Hover-Lift (`transform: translateY(-1px)` via CSS-Klasse).
  - Region-Polygon: **kein** `click`-Handler mehr, kein `cursor`-Wechsel. `mouseover/mouseout` bleiben (oder werden entfernt, da sie aktuell nichts ändern — fillOpacity bleibt 0.55).
- So entsteht keine versehentliche Navigation beim Pannen/Zoomen über die grüne Fläche.

### 4. Relief stärker zeigen
- Relief-`TileLayer`: `opacity={0.35}` → `opacity={0.65}`.
- Aussen-Maske leicht aufhellen, damit Relief im Außenbereich nicht zu dunkel wird: `fillOpacity: 0.78` → `0.6`.

### Unverändert
- swisstopo Basiskarte, See-Polygon, REGION-Grün (`#7ebd5a`, 0.55), Zoom/Bounds (`minZoom 9` / `maxZoom 17`), Tag/Nacht-Logik (06–20), `MarkerPill`-Layout, `fetchForecast`, Routen.
