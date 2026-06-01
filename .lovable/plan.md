## Aufgabe

Den blauen "Karte öffnen ↗"-Banner aus allen Embed-Snippets entfernen.

## Änderungen

- `src/routes/embed.radar.tsx`, `src/routes/embed.wind.tsx`, `src/routes/embed.pollen.tsx`, `src/routes/embed.region.tsx`, `src/routes/embed.all.tsx`: `<EmbedFallbackBar … />` und den zugehörigen Import entfernen.
- `src/components/embeds/embed-fallback-bar.tsx`: Datei löschen (wird nirgends sonst verwendet).

Lokalprognose Amriswil (`embed.region-lokal.tsx`) ist nicht betroffen, da sie den Banner schon nicht nutzt.
