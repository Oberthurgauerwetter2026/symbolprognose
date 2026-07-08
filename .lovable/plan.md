## Diagnose (Vermutung)
Das Manifest kommt korrekt (5 Frames für 04.07.–08.07.), also klemmt es beim Laden der GIBS-Kacheln selbst. Wahrscheinlichste Ursachen:

1. **Layer/Datum**: VIIRS_NOAA20 Truecolor für "heute" (08.07.) ist evtl. noch nicht publiziert — GIBS gibt für nicht existierende Datum-Kacheln oft leere/404-Antworten. Latency von 12 h reicht nicht immer.
2. **`onProgress` bleibt bei 0**: Die Kacheln laden zwar teilweise, aber `load`-Event feuert nur, wenn alle sichtbaren Tiles im Layer geladen sind. Bei 404 zählt der Layer nie hoch → `ready`-Gate bleibt aus → Overlay bleibt schwarz.
3. **`{y}`-Konvention**: sollte für GIBS `GoogleMapsCompatible_Level9` passen (XYZ top-left), aber falls doch invertiert wird, kämen 404er.

## Fix-Plan

### A) Latency & Fallback-Layer robust machen
- Latency auf 30 h erhöhen (frames dann 5 vollständige Vortage: heute-1 … heute-5, kein "heutiges" Bild). Das eliminiert Ursache 1.
- Optional: bei GIBS-`tileerror` auf MODIS_Terra_CorrectedReflectance_TrueColor umschalten (existiert seit 2000, immer verfügbar).

### B) Ready-Gate provider-abhängig
Aktuell startet Auto-Play erst bei 80 % geladenen Frames. Für GIBS mit 5 Tagesframes reicht das, aber falls einzelne Frames 404en, hakt es. Änderung: **erster Frame reicht** als "ready" (Schwelle auf `>=1` statt `>=0.8*total`), damit der aktuelle Frame sofort sichtbar wird und die Zeitleiste sich bedienen lässt.

### C) Sichtbarkeit sicherstellen
- Kartenhintergrund von `bg-black` beibehalten, aber prüfen, dass `L.tileLayer(...)` tatsächlich rendert (kein CORS-Problem — GIBS hat freie CORS-Header, sollte OK sein).
- Nach Umsetzung im Build-Modus einen echten HTTP-GET auf eine konkrete Tile-URL (`.../GoogleMapsCompatible_Level9/6/23/34.jpg`) durchführen, um Layername/Datum/URL-Schema zu verifizieren, bevor ich weitere Änderungen mache.

## Umsetzungsschritte
1. `src/lib/satellite.functions.ts`: `latencyMinutes` der HD-Region auf `30*60`; Frames starten bei heute-1.
2. `src/components/maps/satellite-map.tsx`:
   - Ready-Schwelle: `total > 0 && loaded >= 1`.
   - Bei GIBS-`tileerror` einmalig auf `MODIS_Terra_CorrectedReflectance_TrueColor` umschalten (analog zum EUMETSAT-Fallback-Mechanismus).
3. Live-Test einer GIBS-URL (curl) zur Bestätigung.

Kann ich diesen Fix so umsetzen?