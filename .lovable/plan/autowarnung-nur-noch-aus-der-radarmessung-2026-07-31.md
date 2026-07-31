# Autowarnung nur noch aus der Radarmessung

## Ziel

Die automatische Gewitterwarnung stützt sich ausschliesslich auf die gemessenen Radarwerte (`radar/region-max.json`). Das ICON-CH1-Prognosefeld löst keine Warnungen mehr aus.

## Änderung

1. **Auslöser**: Nur noch die je Gemeinde gemessene Spitzenintensität (mm/h) des neuesten Radarbildes entscheidet über Stufe 1/2/3 (Schwellen 8 / 15 / 30 mm/h bleiben).
2. **Kein Vorlauf mehr**: Der 30-Minuten-Vorlauf (`LEAD_MS`) entfällt, weil eine gemessene Zelle bereits vorhanden ist. Gültig ab jetzt, Gültigkeit bis 45 Minuten nach dem letzten Messwert.
3. **Warntext**: Immer „Aktuell gemessene Spitzenintensität X mm/h". Die Zugbahn-Angabe („Zellen ziehen mit … km/h aus …") wird künftig aus der Verlagerung der gemessenen Zellen zwischen den letzten Radarbildern abgeleitet; ist das nicht möglich, entfällt der Satz.
4. **Fehlt die Messung** (z.B. Radar-Ingest ausgefallen): keine neuen Autowarnungen, Hinweis „Radarmessung nicht verfügbar" im Lauf-Protokoll; bestehende Autowarnungen laufen normal ab.
5. Stufen, Push-Verhalten, 5-Minuten-Intervall und das Beenden nicht mehr erkannter Warnungen bleiben unverändert.

## Technische Details

- `src/lib/auto-thunder.server.ts`: Prognosezweig (`getOpenMeteoCache`, `points`/`minutely_15`-Auswertung, `slots`, `LOOKAHEAD_MS`, `LEAD_MS`) entfernen. `perRegion` wird allein aus `getRadarRegionMax().regions` gefüllt. `regionOf()`/`REGION_POLYS`/`distKm` werden nicht mehr gebraucht (Regions-IDs kommen fertig aus dem Ingest) und entfallen.
- Bewegungsschätzung: `scripts/ingest_radar.py` schreibt in `radar/region-max.json` zusätzlich den Schwerpunkt des Messfeldes (`cx`, `cy` in Grad) je Frame; `auto-thunder.server.ts` vergleicht den Schwerpunkt des aktuellen Frames mit dem in der Datei mitgeführten Vorgängerwert (`prev`) und leitet daraus Richtung/Geschwindigkeit ab (nur bei ≥ 5 km/h ausgewiesen).
- `params` der Warnung: `{ value, auto: true, measured: true }`.
- Altersprüfung der Messung bleibt bei maximal 30 Minuten.
- Wirksam nach Deploy; die Datei `radar/region-max.json` liefert der bestehende 5-Minuten-Radar-Ingest.
