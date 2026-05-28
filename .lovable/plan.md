## Ziel

Die beiden meistgenutzten Embeds (`/embed/radar`, `/embed/lokal`) sollen auch ohne JavaScript brauchbare Inhalte liefern: aktuelle Werte plus weiterführender Zeitverlauf. Die interaktiven Komponenten (Radar-Animation, Slider, Ortung, Tag-Tabs) bleiben JS-gebunden — der Fallback wird über SSR + `<noscript>` so eingebettet, dass JS-Browser nichts davon sehen.

## Geltungsbereich

- `/embed/lokal` — Lokalprognose Amriswil (Default-Koordinate aus `WeatherWidget`).
- `/embed/radar` — Radar-Karte.

Andere Embeds (`region`, `wind`, `pollen`, `all`, `region-lokal`) bleiben unverändert.

## /embed/lokal — Fallback-Inhalt

SSR-Loader holt `getMultiModelForecast({ lat, lon })` für Amriswil und rendert in einem `<noscript>`-Block:

1. **Jetzt-Kachel**: aktuelle Temperatur, Wettersymbol-Text (z. B. „leicht bewölkt"), Niederschlag mm/h, Windgeschwindigkeit + Richtung, Stand-Zeitstempel.
2. **Heute stündlich** (nächste 12 h): semantische `<table>` mit Spalten Zeit / Symbol-Text / Temp / Niederschlag mm / Wind km/h.
3. **7-Tage-Übersicht**: `<table>` mit Datum / Symbol-Text / Min–Max °C / Niederschlagssumme / max. Windböe.
4. Quellenangabe + Link auf `https://symbolprognose.lovable.app/karten/lokal` für die Vollversion.

Styling: minimal, mit den vorhandenen Tailwind-Tokens (`bg-card`, `text-foreground`, `border-border`) und semantischem HTML. Kein JS, keine Icons aus Lucide (die brauchen React-Hydrate); stattdessen kurze deutsche Symbol-Texte aus `weather.ts`.

## /embed/radar — Fallback-Inhalt

Die Karte (Leaflet) ist ohne JS nicht abbildbar. Im `<noscript>`-Block:

1. **Aktuelles Radarbild als statisches `<img>`**: `precipUrl` des neuesten `source==="radar"`-Frames aus dem bestehenden Manifest (SSR-Loader ruft `getRadarFrames()` o.ä.). Mit `alt`-Text inkl. Zeitstempel und `width/height` für Layout-Stabilität.
2. **Niederschlagsverlauf Amriswil** (nächste 6 h, 15-min-Raster): kompakte `<table>` mit Zeit + mm/h aus demselben Multi-Model-Cache (`hourly_icon_ch1.precipitation`/`minutely_15` falls vorhanden, sonst `hourly`).
3. **Tages-Niederschlagssumme nächste 3 Tage** als kleine Tabelle.
4. Link „Interaktive Karte mit Animation öffnen" → `https://symbolprognose.lovable.app/karten/radar`.

## Technische Umsetzung

### Route-Anpassungen

- `src/routes/embed.lokal.tsx`:
  - SSR aktiv lassen (default). Loader hinzufügen, der `getMultiModelForecast` für die Amriswil-Default-Koordinate aufruft und ein kompaktes Fallback-Payload zurückgibt (nur die wenigen Felder, die wir rendern).
  - Component: zuerst `<noscript>{<LokalFallback data={...} />}</noscript>`, danach wie bisher `<EmbedShell><WeatherWidget initialDayIdx={day} /></EmbedShell>`.
- `src/routes/embed.radar.tsx`:
  - `ssr: false` auf `true` ändern. Loader holt das Frame-Manifest (`getRadarFrames`) + denselben Multi-Model-Forecast für Amriswil, extrahiert das jüngste Radar-PNG und ein Mini-Zeitreihen-Array.
  - Component: `<noscript>{<RadarFallback ... />}</noscript>` plus bestehender `<EmbedShell><RadarMap bare /></EmbedShell>`.
  - `RadarMap` selbst wird in einem `<ClientOnly>`-Wrapper bzw. via `useEffect`-Mount-Gate gerendert, damit der SSR-Pass keinen Leaflet-Code anfasst (Leaflet braucht `window`). Konkret: kleines `MountedOnly`-Util, das beim SSR `null` liefert.

### Neue Komponenten

- `src/components/embeds/lokal-noscript.tsx` — präsentationale, JS-freie Tabellen für Lokalprognose. Reine Props, keine Hooks.
- `src/components/embeds/radar-noscript.tsx` — `<img>` + Tabellen für Radar.

Beide nutzen ausschließlich Tailwind-Klassen mit semantischen Tokens; kein State, keine Effekte, keine Icon-Libraries.

### SSR-Sicherheit

- `RadarMap` ist heute via `ssr: false` umgangen. Beim Aktivieren von SSR sicherstellen, dass der Leaflet-Import (`react-leaflet`) clientseitig dynamisch geladen wird, sonst kracht der Worker-Build. Lösung: Mount-Gate (`if (!mounted) return null;`) im `RadarMap`-Wrapper oder dynamischer Import per `lazy()`. Falls das zu invasiv ist, Alternativplan B unten.

### Plan B (falls SSR von RadarMap zu riskant)

Statt `ssr: true` auf der Radar-Route: serverseitig nur den `<noscript>`-Block via dedizierter Server-Route generieren und beim Embed-iframe `<noscript>`-Inhalt direkt aus dem HTML-Shell des Vite-SSR-Outputs liefern. Konkret: kleine TanStack-Server-Route `/api/public/embed/radar-fallback` liefert HTML-Snippet; das wird im Embed-Snippet via separater `<iframe>`-Fallback gar nicht gebraucht — stattdessen rendert die Route `embed.radar.tsx` den `<noscript>`-Block direkt aus einem Loader, und der `RadarMap`-Mount bleibt clientseitig (Mount-Gate).

Bevorzugt wird Plan A mit Mount-Gate, weil weniger Code.

## Out of scope

- Statische Bildgenerierung neuer Assets (es wird das bestehende Radar-PNG aus R2 wiederverwendet).
- Andere Embeds.
- SEO-Indexierung — `<meta name="robots" content="noindex">` bleibt.
- Änderungen am Ingest, Nowcast oder ICON-CH1-Blending.

## Akzeptanz

- `curl --user-agent "test" https://symbolprognose.lovable.app/embed/lokal` liefert HTML mit sichtbarer Jetzt-Kachel, 12-h-Tabelle und 7-Tage-Tabelle innerhalb `<noscript>`.
- `curl ... /embed/radar` liefert HTML mit `<img>` auf aktuellem Radar-PNG + Niederschlagstabelle.
- Im normalen Browser ist von beidem visuell nichts zu sehen (Browser blendet `<noscript>` aus).
- Bestehende interaktive Embeds funktionieren unverändert.
