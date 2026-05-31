## Problem

Der Workflow `Radar Ingest` wird regelmässig mit `Error: The operation was canceled.` beendet — bereits beim `setup-python`/Pip-Cache-Schritt. Ursache: in `.github/workflows/radar-ingest.yml` ist

```yaml
concurrency:
  group: radar-ingest
  cancel-in-progress: true
```

gesetzt. Der Cloudflare-Trigger-Worker stösst alle 5 Minuten einen neuen Lauf an. Sobald der Folge-Lauf in die Queue kommt, killt GitHub den noch laufenden Job — auch dann, wenn dieser noch nicht einmal beim eigentlichen `Run ingest`-Schritt ist. Resultat: kein einziger Lauf kommt zu Ende, das Manifest wird nicht aktualisiert.

## Änderung

Nur eine einzige Zeile in `.github/workflows/radar-ingest.yml`:

```yaml
concurrency:
  group: radar-ingest
  cancel-in-progress: false
```

Damit gilt:
- Läuft bereits ein Ingest, wartet ein neu getriggerter Lauf bzw. wird von GitHub verworfen.
- Der aktuell laufende Ingest darf seinen `Run ingest`-Schritt sauber zu Ende führen.
- Timeout (`timeout-minutes: 15`) bleibt als Schutz vor echten Hängern bestehen.

## Nicht Teil dieses Plans

- Keine Änderungen an `scripts/ingest_radar.py`, an der Versionsnummer (`v13-safe-cpc-rebuild`) oder an `src/lib/radar.functions.ts`.
- Keine Änderung am Cron-Worker-Intervall.

## Verifikation

- Workflow neu auslösen, Ende des Laufs abwarten (sollte jetzt nicht mehr "canceled" sein).
- Debug-Endpunkt prüfen: `latestPrecipTs` aktualisiert sich wieder im 5-Minuten-Takt.

## Dateien

- `.github/workflows/radar-ingest.yml`
