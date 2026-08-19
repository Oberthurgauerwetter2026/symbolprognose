# Embed-Snippet der Windprognose auf die echte Windkarte umstellen

## Problem

`/embed/wind` rendert weiterhin den Platzhalter `ComingSoonMap` — also den Stand vor der Fertigstellung der Windkarte. Nur das kompakte Widget `/embed/widget-wind` (Momentaufnahme ohne Zeitsteuerung) nutzt die echte Karte.

## Ziel

Das Embed „Wind“ zeigt die vollständige Windprognose wie auf `/karten/wind` — Animation, Zeitsteuerung/Filmstrip, Quellenzeile — aber ohne Wetterboard-Rahmen (keine Sidebar, keine Seitenkopfzeile, keine Kartenreiter).

## Umsetzung

1. `src/routes/embed/wind` (`src/routes/embed.wind.tsx`)
   - Platzhalter `ComingSoonMap` entfernen.
   - Stattdessen die Windkarte im randlosen Modus einsetzen: `LazyWindMap` mit `bare` (ohne `snapshot`, damit Animation und Zeitsteuerung erhalten bleiben), in `ClientOnly` + `Suspense` mit `MapSkeleton`-Fallback — analog `/embed/widget-wind`.
   - Im Loader wie bei den anderen Karten-Embeds parallel vorwärmen: `setEmbedCacheHeaders()`, `preloadWindMap()` und `context.queryClient.prefetchQuery(windFramesQuery())`.
   - `EmbedShell fillViewport` verwenden, damit die Karte die iframe-Höhe füllt; Titel/`robots: noindex` bleiben.

2. `src/routes/embed-info.tsx`
   - Eintrag „Wind“ präzisieren: Label „Windprognose (wie Original)“, Beschreibung auf Animation/Zeitsteuerung ohne Wetterboard-Rahmen anpassen, Höhe 600px beibehalten.
   - Der bestehende Eintrag „Widget: Windprognose aktuell“ bleibt unverändert als kompakte Variante.

Keine Änderungen an Datenquellen, Ingest oder Datenbank.

## Prüfung

`/embed/wind` im Browser öffnen und per Screenshot bestätigen: Karte lädt, Windanimation läuft, Zeitsteuerung bedienbar, kein Rahmen/Platzhalter; Snippet-Liste in `/embed-info` prüfen.
