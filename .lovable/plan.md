## Ziel

Beide „Lokalprognose"-Embeds (`/embed/lokal` und `/embed/region-lokal`) sollen wirklich nur den detaillierten Prognose-Bereich zeigen — keine Karte, keine Suche, keine Tagesleiste, keine Fallback-Bar.

## Änderungen

### 1. `src/routes/embed.lokal.tsx`
- `EmbedFallbackBar` entfernen (Import + Render).
- `WeatherWidget` mit `detailOnly compact lockedLocation={AMRISWIL}` rendern (analog `/embed/region-lokal`).
- `initialDayIdx` und das `day`-Search-Param bleiben unverändert, damit bestehende Links weiter funktionieren.
- `<noscript>`-Fallback (`LokalNoscript`) bleibt unverändert.

### 2. `src/routes/embed-info.tsx`
- Beschreibungstext beim „Einzelne Karten → Lokalprognose"-Snippet anpassen, damit klar ist: nur Detailbereich, keine Suche.
- Snippet-Code selbst (iframe/Snapshot) unverändert.

### Unverändert
- `/embed/region-lokal` bleibt wie aktuell (zeigt schon nur den Detailbereich für Amriswil).
- Route-Pfade `/embed/lokal` und `/embed/region-lokal` bleiben.
- Alle anderen Embeds, Karten und Snapshots bleiben unverändert.

## Hinweis

Damit sind `/embed/lokal` und `/embed/region-lokal` funktional identisch (beide Amriswil, Detailbereich). Falls `/embed/lokal` stattdessen eine offene Orts-Suche behalten soll, bitte kurz Bescheid geben — dann lasse ich dort `lockedLocation` weg und nur `detailOnly compact` aktiv (die Standortwahl bleibt dann sichtbar, Tagesleiste/Karte verschwinden).
