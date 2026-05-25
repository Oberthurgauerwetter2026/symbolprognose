
# Echtes MeteoSchweiz-Radar (CPC + Hagel) via GitHub Actions → R2 → App

## Architektur

```text
MeteoSchweiz OGD STAC API
   │  (alle 5 min)
   ▼
GitHub Actions Cron  ──── python: h5py, numpy, Pillow, boto3
   │   1) STAC abfragen: neue CPC- und POH/MESHS-Frames
   │   2) HDF5 herunterladen, auf Oberthurgau-Bbox croppen
   │   3) PNG mit Farbpalette + Alpha rendern (EPSG:3857-Reprojektion)
   │   4) Upload nach Cloudflare R2 (S3-API)
   │   5) frames.json (Manifest) aktualisieren
   ▼
Cloudflare R2 (public bucket, S3-kompatibel)
   │  radar/precip/<ts>.png
   │  radar/hail/<ts>.png
   │  radar/frames.json
   ▼
Lovable-App (TanStack Start)
   │  Server-Fn liest frames.json (mit Cache-Control)
   │  Leaflet ImageOverlay + Timeline (vorhandene radar-map.tsx)
```

## Warum Cloudflare R2 statt AWS S3

- **Kostenlos** bis 10 GB Storage + 10 Mio Reads/Monat (reicht für Jahre Radar-Archiv)
- Keine Egress-Gebühren (AWS S3 verrechnet Traffic)
- S3-kompatible API → identischer Python-Code wie für AWS
- Eigene `pub-xxx.r2.dev` Domain → Bilder direkt im Browser ladbar, kein Signed-URL nötig

## Schritt-für-Schritt-Setup (was du machst)

### 1. Cloudflare R2 Bucket anlegen (5 min)
- Cloudflare-Account erstellen (gratis)
- R2 aktivieren → Bucket `symbolprognose-radar` anlegen
- Public Access aktivieren → URL `https://pub-<hash>.r2.dev` notieren
- API Token erstellen: R2 → Manage API Tokens → "Object Read & Write" für diesen Bucket → `Access Key ID` + `Secret Access Key` notieren

### 2. GitHub-Repo des Projekts mit Lovable verbinden
Plus-Menü → GitHub → Connect project (falls noch nicht geschehen)

### 3. GitHub Secrets eintragen (im verbundenen Repo)
Settings → Secrets and variables → Actions → New secret:
- `R2_ACCOUNT_ID` (Cloudflare Account-ID)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (z. B. `symbolprognose-radar`)
- `R2_PUBLIC_URL` (z. B. `https://pub-abc123.r2.dev`)

## Was Lovable baut

### A) Konverter-Service (im selben Repo, läuft auf GitHub)
- **`.github/workflows/radar-ingest.yml`** — Cron `*/5 * * * *`, läuft Python-Script, 2-min Timeout
- **`scripts/ingest_radar.py`** — Hauptlogik:
  - STAC-Polling: `ch.meteoschweiz.ogd-radar-precip` (CPC, mm/h) + `ch.meteoschweiz.ogd-radar-hail` (POH %)
  - Nur Frames der letzten 3 h verarbeiten, die noch nicht in R2 sind (HEAD-Check)
  - H5 laden (`h5py`), Dataset extrahieren, auf Bbox `[8.8, 47.4, 9.6, 47.7]` croppen
  - Reprojektion CH1903+/LV95 → WebMercator (`pyproj`)
  - Farbpalette identisch zur MeteoSchweiz-Skala (0.1/0.4/0.7/1.3/2/3.5/6/10/20/30/50/80/130/200/350 mm/h), `< 0.1 mm/h` transparent
  - Speichern als PNG mit Alpha, Upload nach R2 unter Key `radar/precip/<ISO-ts>.png`
  - Manifest `radar/frames.json` neu schreiben: `[{ ts, precipUrl, hailUrl?, bbox }]` der letzten 24 h
  - Alte Frames (>24 h) aus R2 löschen
- **`scripts/requirements.txt`** — `h5py`, `numpy`, `pillow`, `pyproj`, `boto3`, `requests`

### B) App-Integration (Lovable-Codebase)
- **`src/lib/radar.functions.ts`** — neue Server-Fn `getRadarFrames`:
  - Fetcht `${R2_PUBLIC_URL}/radar/frames.json` (Cache 60 s)
  - Returnt `{ frames: [{ t, source: 'radar'|'icon-ch1'|'icon-ch2', precipUrl, hailUrl }], bbox }`
  - Vergangenheit (-3 h bis jetzt) = R2-PNGs, Zukunft (+33 h / +120 h) = bestehender Open-Meteo-Code bleibt für Modellprognose
- **`src/components/maps/radar-map.tsx`** — Umbau:
  - Für `source === 'radar'`: Leaflet `ImageOverlay` mit der PNG-URL (statt Canvas-Interpolation)
  - Für ICON-Frames: bestehender Canvas-Code bleibt
  - Smooth-Übergang beim Sprung von Messung → Prognose
- **`src/components/maps/radar-legend.tsx`** — MeteoSchweiz-Farbskala übernehmen (15 Klassen)
- **`src/components/maps/radar-timeline.tsx`** — Toggle „Hagel-Layer einblenden" aktivieren (statt „coming soon")

## Was ausserhalb des Scope bleibt
- **Blitze**: nicht in OGD verfügbar (kommerzielle Lizenz). Bleibt „coming soon".
- **Echtzeit < 5 min**: STAC hat ~5–10 min Verzögerung gegenüber Live-Radar; GitHub-Cron-Lag kann weitere 1–5 min addieren → Latenz ~10–15 min ist realistisch.
- **Historie > 24 h**: aus Kostengründen wird nur das rollende 24-h-Fenster vorgehalten.

## Reihenfolge der Umsetzung

1. Du legst R2-Bucket + GitHub-Secrets an (s. o.)
2. Lovable: Konverter committen (`scripts/` + `.github/workflows/`)
3. Workflow manuell triggern, prüfen dass Frames in R2 landen
4. Lovable: App-Integration (Server-Fn + Map-Umbau)
5. Verifikation auf `/karten/radar`: Vergangenheit zeigt echtes Radar, Zukunft zeigt ICON

## Technische Details

- **HDF5-Struktur CPC**: Dataset `/dataset1/data1/data` (uint8, gain/offset in `what`-Attribut), Geo-Referenz in `/where`
- **Bbox-Crop**: aus 710×640 CH-Raster wird ein ~80×60 px Oberthurgau-Subset → PNGs ~5–15 KB
- **R2 Pricing-Realität**: 288 Frames/Tag × 2 Produkte × 10 KB ≈ 6 MB/Tag, mit Hagel ≈ 12 MB/Tag → bei 24 h-Retention dauerhaft ~12 MB Storage (gratis-tier endet bei 10 GB)
- **GitHub Actions Quota**: 5-min-Run × 12 Mal/h × 24 h × 30 = 2160 min/Monat → liegt knapp über free-tier (2000 min). Workaround: Cron auf `*/10` (~1080 min/Monat) oder bezahltes GH-Plan ($0.008/min). Empfehlung: erst mit `*/10` starten, bei Bedarf hochdrehen.
