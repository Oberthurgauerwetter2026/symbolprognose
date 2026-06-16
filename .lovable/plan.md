# Local-Forecast Ingest fixen

## Status quo

- Cron-Worker + GitHub-Actions-Workflow triggern korrekt: `mch/local_forecast.json` wird stündlich frisch nach R2 geschrieben (`generatedAt` aktuell, Stand vor ~10 Min).
- **Aber:** Für jeden der 8 Spots sind `hourly.time = []` und `daily.time = []`. Die App zeigt deshalb weiterhin den Open-Meteo/MOSMIX-Fallback.
- Ursache reproduziert: in `scripts/ingest_mch_local_forecast.py` schließt `io.TextIOWrapper(r.raw, …)` den darunterliegenden Stream nach dem ersten Chunk (Header), die folgende `for row in reader`-Schleife wirft `ValueError: I/O operation on closed file`. Die Retry-Logik fängt das ab — in einem der Retries läuft der Stream offenbar nur bis zum Header und wird als Erfolg mit leerem `out` zurückgegeben.
- Die Point-IDs (`932600`, `858000`, `922301`, `859601`, `859000`, `922500`, `858508`, `931500`) sind in der MCH-CSV vorhanden — das Mapping selbst ist korrekt.

## Was geändert wird

**Nur `scripts/ingest_mch_local_forecast.py`** — Streaming-Logik in `stream_csv()` ersetzen:

1. Statt `io.TextIOWrapper(r.raw, …)` `response.iter_lines(decode_unicode=True, chunk_size=64*1024)` verwenden und mit `csv.reader` über einen Generator füttern. Das hält den HTTP-Stream sauber bis zum Schluss offen.
2. Header über die erste Zeile parsen, Länge prüfen, dann zeilenweise filtern.
3. Bei tatsächlich leerem Ergebnis (`sum(len(v) for v in out.values()) == 0` nach erfolgreichem Durchlauf): `RuntimeError` werfen statt stillschweigend leer zurückgeben — damit der Workflow rot wird und wir es sofort sehen.
4. `r.raw.decode_content = True` entfällt (nicht mehr nötig — requests dekodiert gzip selbst bei `iter_lines`).

Backoff/Retry-Wrapper bleibt unverändert.

## Verifikation

1. Workflow `MCH Local-Forecast (OGD)` manuell triggern (GitHub Actions → Run workflow).
2. `curl https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev/mch/local_forecast.json | head` — prüfen dass `hourly.time` und `daily.time` gefüllt sind (~120 Stunden, ~5 Tage pro Spot).
3. Preview `/karten/lokal` öffnen und kontrollieren, dass das Widget die MeteoSchweiz-Werte zeigt (Datenstand-Footer in `weather-widget.tsx` zeigt aktuelle Zeit).

## Quellenangaben

**Bleiben in diesem Schritt unverändert.** Aktuell stehen sie korrekt — `MeteoSchweiz local_forecast (OGD) · DWD-MOSMIX` ist bereits in `karten.lokal.tsx` und `lokal-noscript.tsx` gesetzt; der Footer im Widget (`weather-widget.tsx:354`) sagt noch `Modelle: ICON-seamless, DWD-MOSMIX` — das ändern wir erst, sobald Schritt 1 verifiziert tatsächlich MCH-Daten liefert, damit die UI nichts Falsches behauptet.

## Technische Details

- Datei: `scripts/ingest_mch_local_forecast.py`, Funktion `stream_csv(url, wanted_pids)`.
- Neue Schleife (Skizze):
  ```python
  with requests.get(url, stream=True, timeout=(15, 300)) as r:
      r.raise_for_status()
      lines = r.iter_lines(decode_unicode=True, chunk_size=64*1024)
      reader = csv.reader(lines, delimiter=";")
      header = next(reader, None)
      if not header or len(header) < 4:
          raise RuntimeError(f"unexpected header: {header}")
      for row in reader:
          if len(row) < 4: continue
          try: pid = int(row[0])
          except ValueError: continue
          if pid in wanted_pids:
              out[pid].append((row[2], row[3]))
  if sum(len(v) for v in out.values()) == 0:
      raise RuntimeError(f"stream_csv returned 0 rows for any wanted pid: {url}")
  return out
  ```
- Read-Timeout auf 300 s erhöht (Datei ist ~36 MB, läuft auf GitHub-Runner deutlich unter 60 s, aber Sicherheit für peak-times).
- Keine anderen Dateien, keine UI-, Worker- oder Workflow-Änderungen.
