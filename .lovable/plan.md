## Ziel

Neue Einbettung „Karte + Detailprognose Amriswil" für externe Websites:
- **Oben**: nur die Wetterkarte (RegionMap) ohne Wochentag-Tabs, ohne Zeit-Slider, ohne Datum-/Quellen-Untertitel, ohne sonstige Überschriften – nur Karte + Pills (Tagesansicht „heute", wie aktuell beim Laden).
- **Unten**: nur die Detailprognose der Lokalprognose (DetailPanel) fix für **Amriswil**, ohne Header (kein Such-/Ortungs-Feld, kein Ortsname), ohne 5-Tage-Strip oben, ohne Footer/Datenstand, ohne Sonnenschein/Schnee-Toggles.

## Umsetzung

### 1. `src/components/region-map.tsx` — `bare`-Variante

- Neuer Prop `bare?: boolean`.
- Wenn `bare`:
  - `DayTabs` nicht rendern.
  - Slider-Block (`HOUR_TICKS`/Range/Thumb-Pille) nicht rendern.
  - Untertitel/„Datenstand …" und sonstige Textzeilen ausserhalb des Kartenrahmens nicht rendern.
  - `viewMode` fest auf `"daily"`, `selectedDayIdx` fest auf `0` (heute, Tagespillen).
- Kartenhöhe/Rahmen bleibt; nur die UI-Chrome wird unterdrückt.
- Bestehendes Verhalten ohne Prop bleibt unverändert (kein Regressionsrisiko für `/karten/region`, `/embed/region`, `/embed/all`).

### 2. `src/components/weather-widget.tsx` — `detailOnly`-Variante

- Neue optionale Props:
  - `detailOnly?: boolean` — versteckt `Header`, „Standort suchen"-Hinweis, `DayStrip`, `Footer`, `DataStamp` und die Sonnenschein-/Schnee-Toggles.
  - `lockedLocation?: { name; latitude; longitude }` — wird als Location gesetzt und kann vom Nutzer im Embed nicht verändert werden (kein Persistieren in `localStorage`, kein Reverse-Geocode-Override).
- Bei `detailOnly`:
  - `location`-State wird aus `lockedLocation` initialisiert; `useEffect` zum Persistieren in `localStorage` übersprungen.
  - Render nur `DetailPanel` (mit `extended=false`, `snow=false`, `selectedDayIdx=0`, `onVisibleDayChange` = no-op oder lokaler State nur fürs Scroll-Tracking, ohne sichtbaren Strip).
  - Wrapper-Padding/Container bleibt für saubere iframe-Höhe; postMessage-Höhenmeldung weiter aktiv.

### 3. Neue Route `src/routes/embed.region-lokal.tsx`

```tsx
export const Route = createFileRoute("/embed/region-lokal")({
  ssr: false,
  component: () => (
    <EmbedShell>
      <RegionMap bare />
      <div className="mt-4">
        <WeatherWidget
          detailOnly
          lockedLocation={{ name: "Amriswil", latitude: 47.5469, longitude: 9.2986 }}
        />
      </div>
    </EmbedShell>
  ),
  head: () => ({
    meta: [
      { title: "Wetterkarte + Lokalprognose Amriswil (Embed)" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
```

Amriswil-Koordinaten werden aus `src/data/spots.ts` (`47.5469 / 9.2986`) übernommen.

### 4. `src/routes/embed-info.tsx` — Snippet ergänzen

- Neuer Abschnitt **„Karte + Lokalprognose Amriswil"** mit `buildSnippet(url, "/embed/region-lokal", "region-lokal", 1100)` als Copy/Paste-iframe-Block (postMessage-Auto-Height wie bei den anderen Snippets).

## Nicht angefasst

- Bestehende Embeds `/embed/region`, `/embed/lokal`, `/embed/all` und die Dashboard-Seiten `/karten/*` bleiben unverändert.
- Wetterdaten-Loader, Map-Daten, Spot-Liste, Icons, Slider-Komponente unverändert.
- Detail-Panel-Optik (blauer Hintergrund etc.) bleibt wie aktuell.
