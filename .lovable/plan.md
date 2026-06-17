# Befund

Die MCH-Pictogramme (inkl. 12/13/24/25 Gewitter, 35 Schneesturm) sind in `mch-spec.ts` korrekt definiert. Das Problem liegt **vor** dem Icon-Dispatcher: in `mch/local_forecast.json` (R2) sind **alle Stunden- und Tagesarrays für alle 8 Orte komplett leer**.

Beleg (frisch aus R2 gezogen, `generatedAt 2026-06-17T20:00:27Z`):

```text
Horn                 mchId=932600  n=0  unique=[]
Amriswil             mchId=858000  n=0  unique=[]
Bischofszell         mchId=922301  n=0  unique=[]
… (alle 8 Spots identisch: 0 Stunden, 0 Tage)
```

Folge: `getAggregatedForecast` findet kein `weathercode_mch`, das Frontend fällt auf den Open-Meteo/WMO-Pfad zurück. Open-Meteo gibt für die aktuelle Wetterlage in Amriswil keine 95er-Codes (Gewitter) aus → der Dispatcher rendert Sonne / Wolken statt `IconThunderstorm` oder MCH-12. Es fehlen also nicht „die Gewittercodes im Icon-Set", sondern die MCH-Daten insgesamt.

# Ursache der leeren Daten

Die Original-CSV (`vnut12.lssw.202606150000.jww003i0.csv` aus STAC) enthält für jeden unserer 8 MCH-Punkte ~217 Stunden inkl. Codes wie `2, 102, 1, …`. Manuell durchgereicht durch dieselbe Filter-Logik wie `stream_csv` kommen 217 Rows pro Spot heraus.

Der Workflow läuft, lädt frisch hoch (`Last-Modified 20:00:27`), produziert aber leere Arrays. Das passiert nur, wenn entweder
1. eine veraltete Script-Version im `main`-Branch lief (alte SPOT-IDs, anderes Parameter-Mapping), oder
2. `stream_csv` für *einzelne* Params Zeilen ausschließlich für andere `point_type_id` lieferte und so `times` aus der Vereinigung leer blieb.

Beides muss das Ingest selbst nachweisbar machen, statt still eine leere Payload zu deployen.

# Plan

## 1. Ingest absichern (`scripts/ingest_mch_local_forecast.py`)

- **Pro Param Treffer pro Wunsch-PID loggen** statt nur `total`: nach `stream_csv` ausgeben, wie viele Rows pro PID gefunden wurden (`{858000: 217, 932600: 217, …}`).
- **Hartes Abbruchkriterium am Ende von `main()`**: wenn alle Locations `len(hourly.time) == 0` haben → `sys.exit("no hourly rows for any spot — refusing to upload empty payload")`. So überschreibt ein kaputter Lauf nie wieder die letzte gute Datei in R2.
- **Min-Treffer pro Wunsch-PID**: wenn für eine konkrete `wanted_pid` in einem hourly-Param 0 Rows zurückkommen, im Log explizit warnen (`WARN: pid 858000 has 0 rows in jww003i0`). Diese Warnung war bisher hinter dem `total>0`-Aggregat versteckt.

## 2. Manuell triggern und verifizieren

- Workflow `MCH Local-Forecast (OGD)` per `workflow_dispatch` neu starten (über bestehenden `cron-worker` oder direkt im GitHub-UI).
- Nach Run: `https://pub-…r2.dev/mch/local_forecast.json` ziehen und prüfen, dass `locations[*].hourly.time.length > 0` und dass `weathercode_mch` echte Werte enthält (1–35 / 101–135).
- Stichprobe für Samstag 20.06.: erwarten Codes 12/24 (Gewitter) zu erkennen, da Open-Meteo für diesen Tag bereits hohe Niederschlagswahrscheinlichkeit liefert.

## 3. Frontend-Verifikation

Sobald `mch/local_forecast.json` wieder gefüllt ist:
- `getAggregatedForecast` reicht `weathercode_mch` durch (siehe `forecast-aggregated.functions.ts:317–318`, unverändert).
- `WeatherIcon` rendert dann direkt `<MchPictogram>` für jeden Stundenslot mit MCH-Code — Gewitter-Stunden zeigen den Blitz aus `mch-spec.ts` (`composeDay(12|13|24|25)`).
- Im Icon-Katalog `/intern/icons` zusätzlich einen Abschnitt **„MCH-Pictogramme (1–35 Tag / 101–135 Nacht)"** ergänzen, der alle 70 Codes mit Label rendert — dort sind Gewitter (12/13/24/25), Schneesturm (35) etc. unmittelbar sichtbar.

## 4. Kein Eingriff in `mch-spec.ts`

Die Symbolik selbst ist korrekt — keine Code-Änderung am Pictogramm-Set. Falls nach dem Refresh in der Live-Vorhersage trotzdem nie ein 12/13/24/25/35 auftaucht, ist das eine Aussage der MeteoSwiss-Daten, kein Frontend-Bug.

# Erwartetes Ergebnis

- `mch/local_forecast.json` enthält für jeden Spot vollständige Stunden- und Tagesserien inkl. `weathercode_mch`.
- Frontend zeigt für Gewitter-Stunden das MCH-Gewitter-Pictogramm.
- Künftige fehlgeschlagene Ingests überschreiben die R2-Datei nicht mehr leise.
