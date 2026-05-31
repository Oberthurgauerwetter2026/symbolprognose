## Ziel

Das Snippet für `/embed/region-lokal` soll keinen fix-hohen 100vh-Rahmen mehr nutzen, sondern sich auf den tatsächlichen Inhalt zuschneiden und vom WordPress-Redakteur in der Höhe anpassbar sein.

## Aktueller Stand

In `src/routes/embed-info.tsx` wird für „Lokalprognose Amriswil" `buildViewportSnippet(...)` verwendet → der Wrapper ist auf `height:100vh / 100dvh` fixiert. Da die Lokalprognose (`detailOnly compact`) nur wenige hundert Pixel hoch ist, entsteht ein riesiger leerer Rahmen.

Die `EmbedShell` (ohne `fillViewport`) sendet bereits `lovable-weather:height` per `postMessage` — das übliche `buildSnippet(...)` nutzt das schon, um die Höhe automatisch nachzuführen.

## Änderung (nur `src/routes/embed-info.tsx`)

1. Region-lokal-Section auf `buildSnippet(url, "/embed/region-lokal", "region-lokal", "region", "/karten/region", 480)` umstellen (Fallback-Starthöhe 480 px, danach Auto-Anpassung per postMessage).
2. Beschreibungstext aktualisieren: „Höhe passt sich automatisch dem Inhalt an. Falls gewünscht, kann der Startwert (`height:480px`) im Snippet beliebig verändert werden — er dient nur als Fallback, solange das iframe lädt oder blockiert wird."
3. Im `buildSnippet`-Wrapper-Style zusätzlich `resize:vertical` ergänzen, damit der Besucher den Rahmen bei Bedarf auch im Browser direkt vergrößern kann (betrifft alle Snippets, ist aber rein additiv und ohne Nebenwirkung; falls unerwünscht, nur für region-lokal über einen optionalen Parameter setzen — Default-Wahl: für alle aktivieren, da harmlos).

## Unverändert

- Route `/embed/region-lokal` selbst (zeigt weiterhin nur `WeatherWidget detailOnly compact` für Amriswil).
- Alle anderen Embeds, Karten, Snapshots.
- `buildViewportSnippet` bleibt im Code (z. B. falls später wieder gebraucht), wird aber nicht mehr aufgerufen.

## Frage

Soll `resize:vertical` nur für das region-lokal-Snippet aktiviert werden, oder global für alle Snippets? Default im Plan: global, da unschädlich.
