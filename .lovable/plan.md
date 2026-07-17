## Ziel
Neues Embed-Snippet für die Satellit-Karte: Region **Schweiz & Alpen** (bestehende Region `alpen-ch`), automatischer **Loop ohne Filmstrip/Bedienelemente** – rein visuell für WordPress.

## Änderungen

### 1. `src/components/maps/satellite-map.tsx`
- Neuen optionalen Prop `loop?: boolean` einführen (Default `false`).
- Bei `loop === true`:
  - Region auf `alpen-ch` fixieren, **Regions-Tabs oben nicht rendern**.
  - `playing` initial auf `true` (Autoplay), `speedMs` = aktueller Default.
  - **Steuerpanel-Block komplett nicht rendern** (der `{total > 0 && …}`-Panel-Block inkl. `FilmstripTimeline`, Play/Pause, Vor/Zurück, Settings entfällt).
  - Karten-Container behält die bestehende `bare`-Optik (voller Höhen-Fill).
  - Ladeplatzhalter/„nicht verfügbar"-Overlay bleiben unverändert.
- Keine Änderungen an Daten-Fetching, Layer-Auswahl, Prefetch, HD-Logik.

### 2. `src/routes/embed.satellit-loop.tsx` (neu)
- Analog zu `src/routes/embed.satellit.tsx`, aber:
  - `SatelliteMapLazy bare loop`.
  - `head.title`: „Satellit Loop (Embed)", `robots: noindex`.
  - `setEmbedCacheHeaders()` im Loader.

### 3. `src/routes/embed-info.tsx`
- Neuer Abschnitt „Satellit Loop (Schweiz & Alpen, ohne Bedienleiste)" mit Snippet via `buildSimpleSnippet(url, "/embed/satellit-loop", 520)`.
- Kurzhinweis: automatischer Loop, keine Regions-Umschaltung, keine Zeitleiste.

## Nicht enthalten
- Keine Änderungen an bestehendem `/embed/satellit` (bleibt mit Filmstrip).
- Keine neue Region, kein neuer Layer.
- Keine Änderungen an Ingest, Manifest oder Kacheldaten.

## Verifikation
- `bun run build:dev` grün.
- Playwright: `/embed/satellit-loop` öffnet, Frames werden geladen, Bild wechselt automatisch, kein Panel/Filmstrip sichtbar.
- `/embed-info` zeigt neuen Snippet-Block korrekt.
