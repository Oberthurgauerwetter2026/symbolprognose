## Befund

Zwei separate Probleme, beide in `scripts/ingest_radar.py` bzw. `src/components/maps/radar-map.tsx`:

### A) Intensitäts-Unterschätzung (Faktor ~3–12×)

Quelle: MeteoSchweiz-STAC `ch.meteoschweiz.ogd-radar-precip` (CPC). Im Ingest wird der h5-Datensatz so dekodiert:

```python
arr = data.astype(np.float32)
arr = arr * gain + offset       # Z. 346–349 in ingest_radar.py
```

und das Ergebnis **direkt als mm/h** in die PNG-Palette gefüttert. Die CPC-Produkte von MeteoSchweiz haben aber je nach Variante drei mögliche `what.quantity`-Werte:

| `quantity` | Bedeutung | Korrekte Umrechnung in mm/h |
|------------|-----------|------------------------------|
| `RATE` | mm/h | identisch (×1) |
| `ACRR` | mm pro 5-min-Intervall | **×12** |
| `dBR` / `dBZ` | logarithmisch | `10**(value/10)` (+ Z-R-Relation für dBZ) |

`what.quantity` wird im Code **nicht gelesen**. Wenn das aktuelle Asset z. B. `ACRR` (5-min-Akkumulation in mm) ist, sehen 4 mm Niederschlag (= 48 mm/h) im Frontend wie 4 mm/h aus → genau das beobachtete Muster (eigene Karte: orange ≈ 10–20 mm/h, Kachelmann/MeteoSchweiz-Web: rot 40–60 mm/h für dieselbe Zelle).

### B) Frame-Latenz im UI (~30 min)

Manifest hat aktuell:
- `generatedAt`: 15:51 UTC
- Neuestes `precipUrl`-Frame: 15:40 UTC (= 17:40 CEST)

Das App-UI zeigte zum Aufnahmezeitpunkt aber `Messung: So, 17:10` (= 15:10 UTC). Das Frontend springt also nicht auf das jüngste verfügbare Messframe, sondern bleibt 30 min dahinter. Wahrscheinlichste Ursache: Initial-Selektion im Timeline-Slider rechnet `now − fixerOffset` statt `last(frames)`.

## Plan

### Schritt 1 — Quantity-aware CPC-Dekodierung (löst Intensität)

In `scripts/ingest_radar.py` → `read_h5_grid()`:

- `quantity` aus `what`-Attrs auslesen (fallback `top_what`): String, häufig `b"RATE"` / `b"ACRR"` / `b"DBZH"`.
- Im Meta-Dict zurückgeben.
- In `process_asset()` nach `sample_to_bbox()` die Werte konvertieren:
  - `RATE` → unverändert
  - `ACRR` mit `interval=5min` (aus `what.startdate`/`enddate` ablesen, sonst 5 annehmen) → `mm_per_h = value * 60 / interval_min`
  - `dBR` → `10 ** (value / 10)`
  - `DBZH` / `dBZ` → Marshall–Palmer `R = (10**(dBZ/10) / 200) ** (1/1.6)` 
- Ergebnis als mm/h in die bestehende `PRECIP_SCALE` einspeisen — keine Palette-Änderung nötig.
- Log: `print(f"  cpc quantity={q} → mm/h conversion applied (factor={factor})")` pro Frame.
- `RADAR_INGEST_VERSION` auf `v10-cpc-quantity-fix` bumpen.
- `.github/workflows/radar-ingest.yml` → `EXPECTED_RADAR_INGEST_VERSION` mit-bumpen.

Sanity-Check im Ingest: nach Konvertierung `print` der Max- und 99-Perzentil-Werte; wenn Max > 200 mm/h → Warnung loggen (Dekodierung falsch).

### Schritt 2 — Timeline springt auf neuestes Frame (löst Latenz im UI)

In `src/components/maps/radar-map.tsx`:

- Initial-Index der Timeline auf `frames.length - 1` setzen (das letzte echte Mess-Frame, *vor* den Nowcast-Frames).
- Wenn der User pausiert hat, jüngsten Frame bei manifest-Refresh **nicht** überschreiben; wenn er auf "Live"-Knopf ist (oder das erste Mal lädt), auf `lastMeasured` springen.
- Header-Label `Messung: …` zusätzlich um `(vor N min)` ergänzen, damit Latenz sichtbar ist.

### Schritt 3 — Diagnose im Debug-Endpoint

`src/routes/api/public/debug/r2-cache.ts` zusätzlich pro Manifest ausgeben:
- `latestPrecipTs`, `latestPrecipAgeMin`
- bereits vorhandene `version` zeigt, ob v10 läuft.

### Schritt 4 — Verifikation

1. Publish + Workflow-Trigger.
2. `/api/public/debug/r2-cache` → `radar.version = "v10-cpc-quantity-fix"`, `latestPrecipAgeMin < 15`.
3. `/karten/radar`: Karte muss bei aktiver Konvektion rote/violette Bereiche (40–60+ mm/h) zeigen, identisch zu MeteoSchweiz-Web bei identischem Zeitstempel.
4. Timeline öffnet auf jüngstem Messframe (nicht 30 min alt).
5. Wenn weiterhin Unterschätzung: Workflow-Log auf `cpc quantity=…` prüfen — der dort geloggte `quantity`-Wert sagt, welcher Konvertierungspfad nötig war.

## Was nicht angefasst wird

- Bbox, Palette, R2-Layout.
- Nowcast / motion.field (separater Plan).
- Hail-Produkt (POH ist in %, kein mm/h).
- Snow-Overlay-Logik.

## Risiken

- Wenn `quantity` zwischen Frames wechselt (z. B. neues Asset hat dBZ statt RATE), greift der Konverter automatisch — Voraussetzung: jeder Frame wird einzeln konvertiert (kein Cache der alten Werte).
- Alte PNGs in R2 sind mit alter Skala gerendert; sie bleiben falsch bis die Cleanup-Retention sie überschreibt. Optional: `cleanup()` einmalig auf 0 h setzen für sofortige Neuerzeugung — sonst dauert es ~24 h bis alles korrekt ist.
