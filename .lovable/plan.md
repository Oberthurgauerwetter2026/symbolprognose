## Ziel
Radar-Aussetzer beseitigen, indem der Browser die MeteoSchweiz-Radardaten **direkt** von geo.admin.ch lädt — komplett ohne GitHub-Cron, ohne R2, ohne Ingest-Pipeline. Damit gibt es keine Lücken mehr durch übersprungene Workflow-Runs.

## Datenquelle
**MeteoSchweiz Niederschlagsradar via Bundes-Geoportal (geo.admin.ch)**
- Layer: `ch.meteoschweiz.messwerte-niederschlagsradar`
- Bereitstellung: WMTS-Time-Service, **alle 5 Minuten** vom Bund offiziell aktualisiert
- Kostenlos, kein API-Key, CORS erlaubt für Browser-Zugriff
- Zeitstempel der verfügbaren Frames werden über die STAC-API von `data.geo.admin.ch` ermittelt → letzte ~2h verfügbar

Das ist exakt dieselbe Datenquelle wie auf meteoschweiz.ch — nur direkt angezapft statt via Ingest-Umweg.

## Was geändert wird

### 1. Client-seitiger Radar-Loader (neu)
- Neue Datei `src/lib/radar-mch-client.ts`:
  - holt die Liste verfügbarer Radar-Timestamps via STAC-API
  - liefert für jedes Frame eine `tileUrl` (WMTS-Pattern mit Timestamp)
  - läuft komplett im Browser, kein Server-Roundtrip
- Auto-Refresh alle 60 Sekunden über React Query → sobald MeteoSchweiz einen neuen Frame veröffentlicht, ist er da

### 2. `radar-map.tsx` umstellen
- Bisher: lädt Server-Funktion `getRadarFrames()` → R2-PNG-Overlay als `ImageOverlay`
- Neu: nutzt direkt den Client-Loader, rendert die Radar-Tiles als `<TileLayer url={...}>` (Leaflet WMTS)
- Animation-Loop (Play/Pause, Frames-Slider) bleibt wie er ist — nur die Tile-Quelle ändert sich
- Vorhersage-Frames (ICON-CH1/CH2) bleiben wie bisher aus Open-Meteo-Cache (das funktioniert ja)

### 3. Aufräumen
- `src/routes/api/public/radar/ingest-trigger.ts` löschen
- Secret `RADAR_TRIGGER_SECRET` aus Lovable Cloud entfernen
- R2-bezogenen Code in `radar.functions.ts` (CPC/POH-Manifest-Logik) entfernen — server-fn liefert nur noch Vorhersage-Frames
- GitHub: du selbst kannst den `radar-ingest`-Workflow im Repo deaktivieren/löschen (mache ich nicht, ist außerhalb von Lovable)

## Was nicht geändert wird
- Vorhersage-Pipeline (Open-Meteo → R2 → Worker) bleibt — die funktioniert
- UI/Animation/Farbskala/Legende des Radars
- Alle anderen Karten

## Vorteile
- **Null Aussetzer**: kein GitHub-Cron mehr im Pfad
- **Aktueller**: Frames sind sofort verfügbar, sobald MCH sie publiziert (kein 5-Min-Delay durch Ingest)
- **Einfacher**: keine Ingest-Skripte, keine R2-Schreibrechte, kein Secret-Management für den Radar

## Risiken / Hinweise
- **CORS**: geo.admin.ch erlaubt browser-seitigen Zugriff bei allen normalen WMTS/STAC-Endpoints. Falls einzelne Endpoints doch blocken, wird ein dünner Edge-Proxy unter `/api/radar-mch/*` nachgerüstet (kein Cron, nur Pass-through bei Bedarf).
- **Mobil-Traffic**: jeder Besucher lädt die Tiles selbst. Bei einem WMTS-Layer in der Schweiz-Region pro Frame sind das ~4–8 Tiles à wenige KB — vernachlässigbar.
- **Embed-Seiten** (`embed.radar.tsx`, `embed.all.tsx`) ziehen automatisch nach, weil sie dieselbe `radar-map.tsx` nutzen.

## Technische Details

```text
Browser ──STAC──► data.geo.admin.ch  (Liste der Frame-Timestamps, alle 60s)
   │
   └──WMTS──► wmts.geo.admin.ch       (Tiles pro Frame)
```

Tile-URL-Schema (vereinfacht):
```
https://wmts.geo.admin.ch/1.0.0/ch.meteoschweiz.messwerte-niederschlagsradar/
default/{TIME}/3857/{z}/{x}/{y}.png
```
`{TIME}` = ISO-Timestamp aus STAC-Antwort (z. B. `2026-05-27T17:15:00Z`).