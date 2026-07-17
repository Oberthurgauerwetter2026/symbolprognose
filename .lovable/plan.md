## Ziel
Blitze auf der Satellit-Karte einblenden. MTG-Lightning-Imager-Daten wären fachlich naheliegend, sind über EUMETSAT aber nur mit Consumer-Key/Secret und einem eigenen Ingest-Pipelinelauf (Datei-Download, Entpacken, Rasterung) nutzbar – das sprengt den Rahmen einer einfachen Erweiterung. Als pragmatische, sofort umsetzbare Lösung nutzen wir **Blitzortung.org** (bodenbasiertes Community-Netz, Sekunden-Latenz, weltweit inkl. Alpenraum).

Darstellung: **Punkte mit Fade-Out** (klassischer Look, gut über Satellitenbild lesbar), **ein-/ausblendbar** via Toggle rechts oben (neben Vollbild). Default: aus, damit die Karte optisch nicht überladen wird.

## Änderungen

### 1. Ingest: `scripts/ingest_blitzortung.py` (neu)
- Läuft in bestehendem GitHub-Actions-Cron (neuer Workflow `blitzortung-ingest.yml`, alle 2 Min).
- Zieht via Blitzortung Websocket-/HTTP-Feed die letzten ~15 min Strikes im Alpen-Bounding-Box (lat 44–49, lon 5–12).
- Schreibt `lightning/latest.json` nach R2 mit `{ generatedAt, strikes: [{ t, lat, lon }] }` (max ~2000 Einträge, 15-min-Fenster).
- Attribution-Vermerk in Kartenfooter.

### 2. `src/lib/lightning.functions.ts` (neu)
- Server-Fn `getLightningStrikes` (unauth, öffentlich), liest `lightning/latest.json` aus R2 mit `Cache-Control: 30s`.

### 3. `src/components/maps/satellite-map.tsx`
- Neuer State `showLightning` (Default `false`, in `localStorage` gespiegelt).
- Neuer Toggle-Button in der Top-Bar (⚡ Icon aus `lucide-react`) neben dem Vollbild-Button; auch in der `bare`-Ansicht sichtbar (im `loop`-Modus **nicht** – Widget bleibt clean).
- Bei `showLightning`: `useQuery(['lightning'])` alle 30 s, rendert eine neue `LightningLayer`-Komponente (SVG-Overlay via Leaflet `Pane` mit `zIndex: 650`).
- Jeder Strike wird als kleiner Kreis mit Glow gezeichnet, Alter → Opacity/Grösse:
  - 0–2 min: hell weiss/gelb, voll opak, radius 6 px
  - 2–8 min: gelb→orange, opacity 0.7→0.3
  - 8–15 min: dunkelrot, opacity 0.2, radius 3 px
  - >15 min: nicht mehr gezeichnet
- Kein Zusammenhang mit `regionId`, funktioniert für Schweiz & Alpen gleich.

### 4. `.github/workflows/blitzortung-ingest.yml` (neu)
- `schedule: */2 * * * *`, `python -u scripts/ingest_blitzortung.py`, Concurrency-Guard analog zu bestehenden Ingest-Workflows.

### 5. Attribution
- Kleiner Hinweis „Blitze: Blitzortung.org" unten rechts über der Karte, nur wenn `showLightning` aktiv.

## Nicht enthalten
- Keine MTG-LI-Integration (später möglich – separater Ingest via EUMETSAT Data Store).
- Kein Loop/Playback der Blitze (immer „aktuelle 15 min"-Live-Ansicht).
- Kein Einfluss auf Radar-, Wind- oder Lokalprognose-Karten.
- Keine Änderungen an bestehenden Satelliten-Frames, Ingest oder Snippets.

## Verifikation
- `bun run build:dev` grün.
- Playwright: `/karten/satellit` – Toggle ⚡ aktivierbar, Punkte erscheinen an plausiblen Positionen, verblassen über die Zeit.
- `/embed/satellit` mit `?lightning=1` bewusst **nicht** unterstützt (Widget-Look bleibt unverändert); klassisches Embed zeigt Toggle regulär.
- Wenn `lightning/latest.json` fehlt → Toggle bleibt sichtbar, Layer ist leer, keine Fehler.
