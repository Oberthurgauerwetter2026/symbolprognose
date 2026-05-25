Blitze von Blitzortung.org als zusätzlicher Layer auf der Radarkarte, gleiches Muster wie die Radar-PNGs: Daten werden per GitHub Action geholt, in R2 gespiegelt und vom Frontend aus R2 gelesen.

## Was du brauchst
- Einen Account auf blitzortung.org (Mitwirkende / Stationsbetreiber bekommen Zugriff auf `data.blitzortung.org/Data/Protected/last_strikes.php`). Reiner Webseiten-Account reicht nicht.
- Zwei neue **GitHub-Repo-Secrets** (nicht Lovable-Secrets, da der Ingest in GitHub Actions läuft):
  - `BLITZORTUNG_USERNAME`
  - `BLITZORTUNG_PASSWORD`

## Schritte

1. **Ingest-Skript** `scripts/ingest_lightning.py`
   - Holt `last_strikes.php` mit Basic Auth.
   - Filtert auf erweiterte Region (BBox ca. 47.0–48.0 N, 8.5–10.0 E) und letzte 30 Minuten.
   - Schreibt nach R2: `lightning/strikes.json` mit `{ generatedAt, strikes: [{ t, lat, lon }] }`.

2. **GitHub-Action** `.github/workflows/lightning-ingest.yml`
   - Cron `*/5 * * * *` (kleinstes GH-Intervall), plus `workflow_dispatch`.
   - Nutzt dieselben R2-Secrets + neue Blitzortung-Secrets.

3. **Server-Funktion** `src/lib/lightning.functions.ts`
   - `getLightningStrikes()` lädt `lightning/strikes.json` aus R2 (gleicher `R2_PUBLIC_URL`-Mechanismus wie Radar), gibt nur Strikes der letzten 30 min zurück, mit Cache-Header (30 s).

4. **Frontend** in `src/components/maps/radar-map.tsx`
   - Toggle „Blitze" aktivieren (kein `disabled` mehr, kein „bald"-Badge).
   - Daten via `useQuery` mit `refetchInterval: 30_000`.
   - Pro Strike ein Leaflet `CircleMarker` (gelber Kern, oranger Rand), Opacity nach Alter:
     - 0–5 min: 100 %
     - 5–15 min: 60 %
     - 15–30 min: 25 %
   - Tooltip mit Zeit (HH:MM) und Distanz zur Mitte.
   - Zähler-Badge „N Blitze (30 min)" neben dem Toggle.

5. **Dokumentation** kurz im Code-Kommentar, wo der User die GH-Secrets einträgt.

## Technische Details
- BBox bewusst grösser als Radar-BBox, damit auch nahe Gewitter ausserhalb der Region sichtbar werden.
- Datenformat von `last_strikes.php` ist eine Reihe JSON-Zeilen mit `time` (ns), `lat`, `lon` — Skript konvertiert `time` zu ISO.
- Cleanup: Skript überschreibt `strikes.json` jedes Mal komplett, keine alten Objekte sammeln sich an.
- Keine neuen Lovable-Cloud-Secrets nötig; nur GitHub-Repo-Secrets.
- Wenn `lightning/strikes.json` fehlt (Action noch nicht gelaufen), liefert Serverfunktion leeres Array — Toggle bleibt nutzbar.