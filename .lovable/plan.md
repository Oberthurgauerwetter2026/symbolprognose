## Ziel

Im Embed `/embed/region-lokal` (Snippet "Karte + Lokalprognose Amriswil") soll nur noch die Lokalprognose für Amriswil angezeigt werden. Karte und Fallback-Bar werden entfernt.

## Änderungen

1. **`src/routes/embed.region-lokal.tsx`**
   - `RegionMapLazy` (Import + Render) entfernen.
   - `EmbedFallbackBar` entfernen.
   - Im `<noscript>`-Fallback statt `RegionLokalNoscript` nur `LokalNoscript` mit `data={noscript.forecast}` rendern.
   - Loader: `getRadarFrames` und `mapImageUrl`-Logik entfernen, nur noch Forecast laden.
   - `<EmbedShell>` enthält nur noch `<WeatherWidget detailOnly compact lockedLocation={AMRISWIL} />`.
   - Titel im `head()` anpassen: "Lokalprognose Amriswil (Embed)".

2. **`src/routes/embed-info.tsx`**
   - Snippet-Label/Beschreibung des Eintrags "Karte + Lokalprognose Amriswil" auf "Lokalprognose Amriswil" umbenennen.
   - Snapshot-Bild (falls genutzt) für diesen Eintrag auf den Lokal-Snapshot umstellen oder weglassen.

## Unverändert

- Route-Pfad `/embed/region-lokal` bleibt (damit bestehende Einbindungen weiter funktionieren).
- `RegionLokalNoscript`-Komponente bleibt im Repo (wird ggf. später entfernt, wenn nirgends mehr referenziert).
- Alle anderen Embeds, Karten und Snapshots bleiben unverändert.
