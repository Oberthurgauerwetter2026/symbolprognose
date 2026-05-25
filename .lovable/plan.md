## Problem

Open-Meteo Free-Tier limitiert auf ~10'000 Requests/Tag pro IP. Aktuell rufen wir Open-Meteo an zwei Stellen:

| Ort | Wer ruft? | Problem |
|---|---|---|
| `src/lib/radar.functions.ts` (Server) | Cloudflare Worker | **Alle Besucher teilen eine Worker-IP** → Limit sofort erreicht |
| `src/lib/weather.ts` (Client) | Browser des Besuchers | Jeder Besucher = eigene IP → unkritisch |

→ Nur die **Server-Calls** müssen wir lösen. Andere Projekte, die genauso aufgebaut sind, profitieren mit.

## Lösung in einem Satz

Open-Meteo nicht mehr vom Worker rufen, sondern via GitHub-Actions-Cron einmalig pro Region in R2 cachen. Der Worker liest nur noch R2.

## Schritte

### 1. Neues Ingest-Script `scripts/ingest_openmeteo.py`
- Läuft alle 5 Min via GitHub Actions (gleicher Mechanismus wie Radar-Ingest)
- Ruft die zwei Open-Meteo-Queries (ICON-CH1 minutely_15, ICON-CH2 hourly) für die Region-BBox einmal
- Schreibt das Ergebnis als `openmeteo/forecast.json` nach R2
- Verbrauch: **288 Requests/Tag** pro Region (vorher: pro Besucher = explodiert)

### 2. `radar.functions.ts` umbauen
- `fetchOpenMeteo()` entfernen
- Stattdessen `openmeteo/forecast.json` aus R2 lesen (analog zum bestehenden Radar-Manifest)
- Worker-CPU sinkt → schneller, billiger, keine Rate-Limits

### 3. Workflow `.github/workflows/openmeteo-ingest.yml`
- Cron `*/5 * * * *`
- Secrets: R2-Credentials (gibt es schon)
- Kein Open-Meteo-Key nötig (Free-Tier reicht für 288 req/Tag)

### 4. Für andere Projekte wiederverwendbar
- Skript akzeptiert BBox + Output-Pfad via ENV-Variablen
- Anderes Projekt: gleicher R2-Bucket, anderer Key (z. B. `openmeteo/projektXY/forecast.json`)
- Oder: ein **gemeinsamer Cache-Worker** als zentrale Pull-Through-Cache-API für alle Projekte

## Tech-Details (zur Info)

```
Open-Meteo  ── 5-min Cron ──▶  R2 (openmeteo/forecast.json)  ◀── Worker (Lese-only)
                                                              ◀── andere Projekte
```

- Cache-Header: `max-age=60, s-maxage=120` bleibt, da R2-Read sehr günstig
- Frontend ändert sich nicht — `getRadarFrames()` bleibt gleicher Vertrag
- Falls R2 down: 503 statt blassem Fehler, Frontend zeigt bereits "Radardaten konnten nicht geladen werden"

## Was wir NICHT tun

- Keinen kommerziellen Open-Meteo-Key kaufen (nicht nötig)
- `src/lib/weather.ts` Client-Calls **nicht** umbauen (jeder Besucher hat eigene IP)
- Keine grosse Refactor-Welle — nur die Daten-Quelle ändern