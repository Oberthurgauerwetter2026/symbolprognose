## Worum es geht

Im GitHub-Account existieren zwei Repos:

- `symbolprognose` — Lovable-Projekt. Hier liegen Frontend **und** der neue Workflow `.github/workflows/radar-ingest.yml` + `scripts/ingest_radar.py` (Version `v4-failfast-manifest-guard`).
- `symbolprognose-radar` — separates Radar-Repo. Vermutlich läuft **dort** noch ein älterer Cron-Workflow, der `radar/frames.json` befüllt.

Das passt zu den Symptomen: Egal wie oft ich `RADAR_INGEST_VERSION` in `symbolprognose` hochzähle, in den Logs erscheint nie das Banner `RADAR INGEST START version=v4-…`, und der `Verify ingest version`-Step greift nie. Das Frontend liest aber das `frames.json`, das vom **alten** Workflow im anderen Repo geschrieben wird → "0 frames", veraltete Diagnostics.

Ziel laut Antwort: **Alles in `symbolprognose` bündeln**, `symbolprognose-radar` stilllegen.

## Plan

### 1. Verifizieren, welcher Workflow wirklich läuft (1 Min, manuell)

Du öffnest auf GitHub jeweils den Tab **Actions**:

- `github.com/<user>/symbolprognose/actions` — läuft hier ein "Radar Ingest" alle 10 Min? Wann zuletzt?
- `github.com/<user>/symbolprognose-radar/actions` — gleiche Frage.

Das Repo, in dem ein Run **innerhalb der letzten 10 Min** auftaucht, ist der aktive. Wahrscheinlich `symbolprognose-radar`.

### 2. Workflow in `symbolprognose-radar` deaktivieren

Im Radar-Repo unter **Actions → Radar Ingest → ⋯ → Disable workflow**. So schreibt nichts mehr "0 frames" über das Manifest. (Repo später archivieren, nicht jetzt löschen — falls wir noch Historie brauchen.)

### 3. R2-Secrets in `symbolprognose` setzen

Im Lovable-Repo unter **Settings → Secrets and variables → Actions** müssen existieren:
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
Vermutlich nur im Radar-Repo gesetzt — bitte aus dort kopieren.

### 4. Workflow im Lovable-Repo scharfschalten

Code ist bereits da (`.github/workflows/radar-ingest.yml` + `scripts/ingest_radar.py v4`). Sobald Secrets stehen:

- **Actions → Radar Ingest → Run workflow** manuell auslösen.
- Erwartete Logs:
  - Step "Show version info" zeigt `expected ingest version: v4-failfast-manifest-guard`.
  - Step "Verify ingest version" geht grün durch.
  - Step "Run ingest" beginnt mit `RADAR INGEST START version=v4-failfast-manifest-guard lookback=12h …`.

### 5. Falls Frames trotzdem 0 bleiben

Dann ist es **nicht mehr** ein Sync-Problem, sondern echtes STAC/MeteoSchweiz-Verhalten. Die v4-Diagnostics zeigen dann sauber:
- HTTP-Status der STAC-Calls,
- `asset ts range oldest=… newest=… count=…`,
- ob der `FALLBACK:`-Pfad gegriffen hat.
Daraus leite ich den nächsten Fix ab (Lookback erhöhen, Asset-Filter anpassen, o.ä.).

### 6. Aufräumen

- `symbolprognose-radar` archivieren (Settings → Archive this repository), sobald 24 h lang der neue Workflow stabil läuft.
- Diesen Plan-Eintrag aus `.lovable/plan.md` entfernen.

## Was ich (Lovable) im Build-Modus dann tatsächlich am Code ändere

Nichts Größeres — der Code ist bereit. Nur:

- Kleines `README`-Snippet in `scripts/ingest_radar.py` (Kommentar oben), das festhält, dass dieses Repo jetzt die einzige Quelle für `radar/frames.json` ist.
- Optional: Default-`RADAR_LOOKBACK_HOURS` von 3 auf 12 ziehen, damit es nicht nur via Workflow-Env funktioniert.

Schritte 1–3 musst du auf GitHub selbst klicken — dort habe ich keinen Zugriff. Schritt 4 ist dann ein einzelner Manual-Run-Klick.