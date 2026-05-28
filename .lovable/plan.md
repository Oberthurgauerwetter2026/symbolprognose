# No-JS-Fallback für „Karte + Lokalprognose Amriswil"

## Ziel
Der kombinierte Embed `/embed/region-lokal` soll – wie bereits `/embed/radar` und `/embed/lokal` – auch ohne JavaScript sinnvolle Inhalte zeigen: aktuelle Prognose mit weiterführendem Zeitverlauf für Amriswil, plus statisches Kartenbild.

## Wichtig für dich
- **Kein Neu-Einbinden nötig.** Die iframe-URL `/embed/region-lokal` bleibt identisch.
- Nach der Änderung nur **publishen**, dann ist der Fallback live.

## Umsetzung

### `src/routes/embed.region-lokal.tsx`
- `ssr: false` → `ssr: true` (damit der `<noscript>`-Inhalt serverseitig im HTML steht).
- `loader` hinzufügen, der `getMultiModelForecast` für Amriswil (lat 47.5469, lon 9.2986) lädt und – wie in `embed.lokal.tsx` – über die `buildNoscript`-Logik die `LokalNoscriptData` aufbereitet (aktuelle Stunde, 12h-Verlauf, 7-Tage-Übersicht). Bei Fehler leeres Fallback-Objekt zurückgeben.
- Optional: statisches Kartenbild aus dem jüngsten Radar-Frame (`getRadarFrames` → `latestImageUrl`) für die „Karte"-Sektion, analog zu `radar-noscript.tsx`. Wenn kein Bild verfügbar, weglassen.
- Interaktive Karte (`RegionMap`) ist Leaflet-basiert und greift auf `window` zu → muss vor SSR-Crash geschützt werden: `RegionMap` per `React.lazy` + `ClientOnly`-Wrapper laden (gleiches Muster wie bei `embed.radar.tsx`).

### Render-Struktur
```text
<>
  <noscript>
    <RegionLokalNoscript mapImageUrl=... forecast=... />
  </noscript>
  <EmbedShell>
    <ClientOnly><RegionMap bare /></ClientOnly>
    <WeatherWidget detailOnly compact lockedLocation={AMRISWIL} />
  </EmbedShell>
</>
```

### Neue Komponente `src/components/embeds/region-lokal-noscript.tsx`
- Reines HTML/Tailwind, kein JS.
- Optional oben das statische Kartenbild (`<img>`), darunter die Lokalprognose-Tabellen. Kann die bestehende `LokalNoscript`-Komponente wiederverwenden, um Doppelarbeit zu vermeiden.

## Abnahmekriterien
- `curl https://symbolprognose.lovable.app/embed/region-lokal` liefert sichtbaren Prognose-Inhalt im `<noscript>`-Block.
- Normale Browser sehen unverändert die interaktive Karte + Widget.
- Bestehende Embeds (`/embed/radar`, `/embed/lokal`, `/embed/all` usw.) bleiben unverändert.

## Nicht im Umfang
- Statische Bildgenerierung der Region-Karte (nur vorhandenes Radar-Standbild wird genutzt, falls verfügbar).
- Andere Embeds, SEO-Indexierung, Ingest/Nowcast-Änderungen.
