# Blitzdaten via KNMI (kostenlos)

## Quelle

KNMI Data Platform — Dataset `lightning-detection-nl23-1-0`:
- Quelle: Météorage (kommerzielles Detektionsnetz, hochwertig in CH/EU)
- Update: alle 5 Minuten
- Format: HDF5-Rohdaten
- Abdeckung: West-/Mitteleuropa inkl. Schweiz
- Auth: API-Key (kostenlose Registrierung auf `developer.dataplatform.knmi.nl`)

## Architektur (identisch zur Blitzortung-Variante)

```text
KNMI Open Data API  →  GitHub-Action (5 min)  →  R2 lightning/strikes.json
                                                         ↓
                                          Server-Fn  →  RadarMap-Frontend
```

## Schritte

### 1. Ingest-Skript `scripts/ingest_lightning.py` (neu)

- Liste letzte Files in Dataset `lightning-detection-nl23` via Open Data API
  (`GET /v1/datasets/lightning-detection-nl23/versions/1.0/files?maxKeys=5&orderBy=created&sorting=desc`).
- Letztes File downloaden via Signed-URL-Endpoint.
- HDF5 parsen mit `h5py` → Strikes (lat, lon, timestamp) extrahieren.
- Filter: BBox 47.0–48.0 N / 8.5–10.0 E, letzte 30 Min.
- Upload nach R2 als `lightning/strikes.json` mit Schema:
  `{ generatedAt, windowMinutes: 30, bbox, strikes: [{ t, lat, lon }] }`.
- `requirements.txt` ergänzen: `h5py`, `numpy`, `requests`, `boto3`.

### 2. GitHub-Workflow `.github/workflows/lightning-ingest.yml` (neu)

- Cron `*/5 * * * *` + `workflow_dispatch`.
- Secrets: `KNMI_API_KEY` (neu) + bestehende R2-Secrets.

### 3. Server-Funktion `src/lib/lightning.functions.ts` (neu)

- Liest `lightning/strikes.json` von R2 (gleiches Muster wie Radar).
- Cache-Header 20s.
- Gibt Strikes der letzten 30 Min zurück.

### 4. Frontend `src/components/maps/radar-map.tsx`

- Import `getLightningStrikes` + `LightningOverlay` wiederherstellen.
- State `showLightning`, `useQuery` mit `refetchInterval: 30_000`.
- Toggle aktivieren (kein `disabled`/"bald" mehr), Strike-Counter im Button.
- Zeit-Fade: ≤5 min 100%, 5–15 min 60%, 15–30 min 25%.

## Was du tun musst

1.  Account auf `https://developer.dataplatform.knmi.nl/` erstellen (gratis).
2.  Im Portal "Open Data API" → "Request an API key" → Key kopieren.
3.  GitHub-Repo-Secret `KNMI_API_KEY` setzen.
4.  Workflow "Lightning Ingest" einmal manuell triggern.

## Risiken / offene Punkte

- **Abdeckungstest CH**: Météorage deckt CH gut ab, aber wir wissen erst nach dem ersten Ingest, wie viele Strikes wirklich in unserer BBox ankommen. Falls dünn, können wir BBox erweitern oder NL25 nicht — NL25 ist nur NL.
- **HDF5-Schema**: Erst nach Download des ersten Files final klar. Skript loggt Felder beim ersten Run.
- **Lizenz**: KNMI-Daten sind CC BY 4.0 — Attribution "© KNMI / Météorage" muss in der UI ergänzt werden.

Nach Approval implementiere ich alle vier Schritte.