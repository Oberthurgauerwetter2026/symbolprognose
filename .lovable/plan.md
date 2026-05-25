## Problem

`frames.json` shows `"frames": []` — der Ingest läuft, findet aber keine Radar-Bilder.

**Ursache:** Der STAC-Endpoint `…/items?limit=10` liefert die Items **chronologisch aufsteigend** (älteste zuerst). Die ersten 10 Items sind aus 2026‑05‑11 ff. — alle älter als das `since`-Fenster (`now − 3 h`), also wird jedes Frame verworfen → 0 hochgeladen, Manifest leer.

Beispiel der aktuellen Antwort:
```
id: "20260511-ch"   ← 14 Tage alt
```

## Fix

In `scripts/ingest_radar.py` → `list_recent_assets(...)`:

1. Den heutigen Tages-Item gezielt holen statt zu paginieren:
   - URL: `…/collections/{coll}/items/{YYYYMMDD}-ch`
   - Fallback auf gestern, falls noch keiner existiert (kurz nach Mitternacht UTC).
2. Aus den `assets` dieses Items die Dateien filtern (Regex bleibt), Zeitstempel parsen, nach `since` filtern, sortieren.
3. Optional zusätzlich: Sort-Parameter `?sortby=-properties.datetime&limit=2` als zweiter Versuch, falls der direkte Item-Abruf fehlschlägt.

Keine Änderungen am Frontend, an `radar.functions.ts` oder am Workflow nötig.

## Nach dem Fix

- Workflow manuell starten (`Actions → Radar Ingest → Run workflow`).
- Log sollte `processed N new frames` + `manifest: N frames` zeigen.
- `…/radar/frames.json` enthält dann `precipUrl` / `hailUrl` pro Frame.
- `/karten/radar` zeigt echte MeteoSchweiz-Bilder.

## Technische Details

- `parse_ts_from_filename` ist korrekt (Format `cpc<YY><DOY><HH><MM>_…`).
- `BUCKET`/`PUBLIC_URL`/R2-Credentials sind ok (sonst wäre `frames.json` gar nicht da).
- Das einzige fehlerhafte Stück ist die Item-Auswahl per `limit=10` ohne Sortierung.
