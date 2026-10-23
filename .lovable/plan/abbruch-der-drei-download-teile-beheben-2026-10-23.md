# Abbruch der drei Download-Teile beheben

## Ursache
Die drei Download-Teile installieren nur ein einziges Hilfspaket. Das Prognose-Skript lädt beim Start aber auch das Speicherpaket (boto3). Darum bricht jeder Teil sofort mit Fehlercode 1 ab, noch bevor eine Abfrage an Open-Meteo geht. Die Meldung „canceled“ ist nur eine Folge davon, denn fällt ein Teil aus, stoppt GitHub die anderen. Die Hinweise zu „Node.js 20“ sind nur Warnungen und nicht der Fehler.

## Behebung
- Im Prognose-Skript wird das Speicherpaket erst dort geladen, wo wirklich gespeichert wird. So laufen die Download-Teile ohne dieses Paket.
- Zusätzlich installieren die Download-Teile dasselbe Paket mit, als doppelte Absicherung.
- Ein Test startet das Skript im Download-Modus ohne Speicherpaket, damit dieser Fehler nicht wiederkommt.

## Technische Details
- `scripts/ingest_openmeteo.py`: `import boto3` von oben in `make_s3()` verschieben.
- `.github/workflows/openmeteo-ingest.yml`: im Job `fetch` `pip install requests boto3`.
- `scripts/test_forecast_publication.py`: Test, dass das Modul ohne `boto3` importierbar ist (`sys.modules["boto3"] = None`, dann frisch importieren).
