# Radar: MeteoSchweiz-Slider + flächendeckende Niederschlagsdaten

## 1. Slider im MeteoSchweiz-Stil

Vorbild (Screenshot von meteoschweiz.admin.ch frisch eingesehen):

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ▶  ‹  09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 00 01 02 03 ›    │
│        ─────────past─────────│────────forecast (blau)──────────      │
│         Dienstag, 26.05.2026          │       Mittwoch, 27.05.2026   │
│ Aktualisiert am 26.05.2026, 15:37                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Eigenschaften:
- Dunkler Hintergrund-Panel unter der Karte, volle Breite.
- Links: runder Play/Pause-Button + Prev/Next-Pfeile.
- Lange horizontale Track-Linie über die ganze Breite.
- Stunden-Labels (HH) direkt **über** dem Track im Stundenraster.
- Vergangenheit dunkel/grau, Vorhersage in Brand-Blau eingefärbt.
- Aktive Position: vertikaler weisser Strich + Tooltip-Bubble "Messung: Dienstag, 15:30" bzw. "Prognose: …".
- Unter dem Track: Tages-Label (wechselt am Tageswechsel-Strich) + "Aktualisiert am …" footer.

### Datei `src/components/maps/radar-map.tsx`

Komplette Re-Implementation der `Timeline`-Komponente + Toolbar-Block:

- Neue Komponente `MeteoTimeline` ersetzt aktuelle `Timeline` + Toolbar-`<div>` (Zeilen ~356–525 und ~725–795).
- Layout: ein `<div className="rounded-2xl bg-[#1a1f24] text-white p-3 shadow-sm">` enthält:
  - `<div class="flex items-center gap-2">`
    - Play/Pause-Button (`rounded-full bg-white/10 hover:bg-white/20 h-9 w-9`)
    - Prev-Frame-Button (`‹`), Next-Frame-Button (`›`) im gleichen Stil
    - Track-Container `flex-1 relative`
      - Track-Linie `h-1.5 bg-white/20 rounded-full`
      - Vorhersage-Range absolute `background: BRAND` von `nowPct%` bis 100%
      - Stunden-Labels: jede volle Stunde im sichtbaren Bereich → `<span class="absolute -top-5 text-[10px] tabular-nums text-white/70" style={{ left: '${pct}%' }}>HH</span>`
      - "Jetzt"-Linie und Tageswechsel-Linien als vertikale Striche
      - Drag-Handle: dünner weisser Strich `w-px h-6 bg-white absolute -top-2.5` + Bubble darüber mit Brand-Blau-Background
  - Unter dem Toolbar-Block:
    - Linkes Tages-Label "Dienstag, 26.05.2026" + ggf. zweites Tages-Label rechts wenn Tageswechsel im Strahl liegt
    - Rechts/links Footer: "Aktualisiert am DD.MM.YYYY, HH:MM"
- Speed-Wahl (1×/2×/4×) wandert in einen kleinen Pill-Group rechts neben den Buttons (kompakt).
- Hagel-Toggle bleibt — als separater Toggle-Button im gleichen dunklen Stil rechts oben über dem Slider-Panel oder neben Speed.
- Pointer-Drag-Logik & Tastatur-Steuerung übernehmen (unverändert), nur das Markup wird neu.

Stunden-Labels-Logik:
- `tickHours` wird dynamisch aus `times[0]…times[last]` generiert: jede volle Stunde, auf Mobile nur 3-h-Schritte.
- Format: `HH` (z.B. "09", "15").

## 2. Niederschlagsabdeckung auf die ganze Karte ausweiten

Aktuell deckt die BBox nur `47.38–47.72 / 9.00–9.62` (Oberthurgau-Kachel) ab. Die Karte selbst zeigt mit `maxBoundsExt` etwa `47.32–47.79 / 8.95–9.70` — also etwas grösser als die Daten. Resultat: Niederschlag wird nur in der inneren Kachel gerendert, der Kartenrand bleibt leer.

### Erweiterte BBox (Bodensee-Region)

Neuer Datenbereich passend zum Karten-Viewport:
- `minLat 47.30, maxLat 47.85, minLon 8.85, maxLon 9.85` (~70 × 60 km)
- Open-Meteo-Grid: `GRID_LAT 12, GRID_LON 20` → 240 Punkte (statt 126). Liegt weiterhin im Free-Tier-Budget des 5-Min-Cron (1 Request pro Punkt = 240 / 5 min = 48 req/min).

### Änderungen

**`scripts/ingest_openmeteo.py`**
- Defaults für `BBOX_MIN_LAT/MAX/MIN_LON/MAX` und `GRID_LAT/LON` anpassen (zur Sicherheit auch im Workflow als ENV überschreiben).

**`.github/workflows/openmeteo-ingest.yml`**
- ENV-Block mit den neuen Werten setzen, damit der Workflow nicht versehentlich Defaults aus dem Repo nutzt.

**`scripts/ingest_radar.py`**
- `BBOX_WGS` auf gleiche Werte erweitern (`9.00→8.85`, `9.62→9.85`, `47.38→47.30`, `47.72→47.85`).
- Damit liefert das CPC-PNG-Crop einen grösseren Ausschnitt; `OUT_W/OUT_H` ggf. proportional erhöhen, damit die Pixel-Auflösung erhalten bleibt.

**`src/lib/radar.functions.ts`**
- `BBOX`-Konstante auf neue Werte updaten. `GRID_LON 20, GRID_LAT 12`.

**`src/components/maps/radar-map.tsx`**
- `maxBoundsExt` an neue BBox anpassen (+kleiner Rand): `[[47.25, 8.80], [47.90, 9.90]]`.
- `center` und `zoom` evtl. leicht raus (`zoom 10` statt `10.5`), damit die ganze BBox initial sichtbar ist.

### Übergangszustand

Solange der GitHub-Workflow noch nicht neu durchgelaufen ist, liefert die Cache-Datei in R2 die alte (kleine) BBox. Der Worker liest `data.imageBbox` aus dem Manifest — das passt also dynamisch. Erst nach dem nächsten erfolgreichen Run der Cron-Jobs füllt die neue Fläche aus.

## Reihenfolge

1. Frontend: Slider neu, neue `maxBoundsExt` (sofort sichtbar).
2. Skripte + Workflow-ENVs: BBox/Grid grösser (greift, sobald die Jobs wieder laufen).
3. Du startest die GitHub-Actions-Workflows neu (re-enable + "Run workflow") → ab nächstem Run kommt die volle Fläche.
