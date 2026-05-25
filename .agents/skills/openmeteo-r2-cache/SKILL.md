---
name: openmeteo-r2-cache
description: Verschiebt Open-Meteo-API-Calls vom Cloudflare Worker/Edge in eine GitHub Action, die alle 5 Minuten in Cloudflare R2 cached. Anwenden, wenn ein Projekt Open-Meteo serverseitig (Worker, Edge Function, SSR-Loader) aufruft und 429-/Rate-Limit-Fehler auftreten, weil sich alle Besucher eine Worker-IP teilen. Nicht anwenden, wenn Open-Meteo nur clientseitig im Browser aufgerufen wird.
---

# Open-Meteo R2-Cache

## Problem

Open-Meteo limitiert pro IP. Cloudflare Workers/Edge Functions teilen sich pro Region eine kleine IP-Pool. Sobald 10+ Besucher pro Minute den Worker aufrufen, ist das Tageslimit erreicht und alle bekommen 429.

## Lösung

```text
GitHub Action (alle 5 min) ─► Open-Meteo ─► R2 (forecast.json)
                                              ▲
Cloudflare Worker / Edge ─────────────────────┘ (liest nur Cache)
```

- **288 Requests/Tag** total (statt N × Besucher) — locker im Free-Tier.
- Worker macht **keine** Open-Meteo-Calls mehr → keine 429.
- Daten max. 5 min alt → für Wetter-UIs ausreichend.

## Voraussetzungen

- Cloudflare R2 Bucket mit öffentlicher URL
- GitHub-Repo verbunden mit dem Lovable-Projekt
- GitHub-Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- Im Worker-Env: `R2_PUBLIC_URL`

## Schritte

1. `templates/ingest_openmeteo.py` → `scripts/ingest_openmeteo.py` kopieren. BBox + Variablen an Projekt-Region anpassen.
2. `templates/openmeteo-ingest.yml` → `.github/workflows/openmeteo-ingest.yml` kopieren.
3. Worker-Calls auf R2 umstellen (siehe `templates/worker-read-cache.ts`).
4. GitHub-Secrets setzen (falls fehlen).
5. Workflow manuell triggern → R2 prüfen.
6. Browser-Test: kein `api.open-meteo.com` mehr im Network-Tab.

## ENV-Vars (Ingest)

| Var | Default | Zweck |
|---|---|---|
| `OPENMETEO_OUT_KEY` | `openmeteo/forecast.json` | R2-Pfad |
| `BBOX_MIN_LAT` / `MAX_LAT` / `MIN_LON` / `MAX_LON` | Oberthurgau | Region |
| `GRID_LAT` / `GRID_LON` | 9 / 14 | Grid-Auflösung |

## Projekt-spezifische Hinweise

- **Amriswil Weather Watch**: siehe `references/amriswil-migration.md`. `pressure-map-generator/` NICHT ersetzen (eigener Use-Case).
- **Reine Client-Calls** (`fetch()` im Browser): nichts tun.
- **Mehrere Regionen pro Projekt**: pro Region eigener `OPENMETEO_OUT_KEY` + eigener Workflow.

## Bundled

- `templates/ingest_openmeteo.py`
- `templates/openmeteo-ingest.yml`
- `templates/worker-read-cache.ts`
- `references/amriswil-migration.md`
