## Ziel

Alle Einbinde-Snippets auf `/embed-info` auf das nötige Minimum reduzieren — ein einfaches `<iframe>`, das man kopieren und einsetzen kann, ohne `<script>`-Block, ohne SVG-Vorschaubild, ohne Hinweis-Boxen. Einzige Ausnahme: **Lokalprognose Amriswil** bleibt unverändert (inkl. ihrem aktuellen postMessage-Höhen-Skript, weil sich dort die Höhe stark dem Inhalt anpasst).

## Änderungen in `src/routes/embed-info.tsx`

1. **Neue, einfache Snippet-Funktion** für alle Karten ausser Amriswil:
   - Reines `<iframe src="…" loading="lazy" style="width:100%;height:{fallbackHeight}px;border:0;display:block" title="Wetter-Karte"></iframe>`
   - Kein `<script>`, kein SVG-Vorschau-`<img>`, kein Wrapper-`<div>` mit Positionierung, kein Watchdog.
   - `fallbackHeight` bleibt parametrisierbar (760 für „alle Karten", default für Einzelkarten).

2. **Komplett-Widget (alle Karten mit Tabs)** und **Einzelne Karten (Region, Wind, Radar, Pollen …)** verwenden ab sofort diese einfache Funktion.

3. **Lokalprognose Amriswil bleibt 1:1**: weiter `buildSnippet(url, "/embed/region-lokal", "region-lokal", null, "/karten/region", 480)` — gleiches Snippet wie heute (mit Höhen-Auto-Resize via postMessage, ohne SVG-Bild).

4. **Hinweis-Boxen entfernen**, weil sie nur den JS-Fallback erklären:
   - Die grüne Box „Neu: garantierter Fallback …"
   - Die graue Box „Bleibt die Karte bei einzelnen Besuchern leer? …" inkl. Liste und Datenquellen-Hinweis am Ende.
   - Den einleitenden Satz auf „Füge im WordPress-Editor einen Custom-HTML-Block (oder iframe-Block) ein und kopiere das Snippet hinein." kürzen.
   - Den orangen Hinweis „Snippets zeigen immer auf publizierte URL …" behalten (das ist kein JS-Hinweis, sondern eine wichtige Publish-Info).
   - Im Beschreibungstext bei Amriswil den Satz über `resize:vertical` etc. behalten (er trifft auf Amriswil weiter zu).

5. **Nicht mehr benötigte Funktionen entfernen**: `buildViewportSnippet` wird aktuell nirgends mehr aufgerufen — bleibt unangetastet (kein Scope-Creep), ausser wir merken beim Edit, dass sie ungenutzt ist und ein Linter-Fehler entsteht. Falls ja: löschen.

## Out of scope

- Keine Änderung an den eigentlichen `/embed/*` Routen oder den Karten-Komponenten.
- Keine Änderung am SVG-Snapshot-Endpoint (bleibt für Amriswil-unabhängige zukünftige Nutzung erhalten).
- Keine Design-/Styling-Änderungen ausserhalb des Entfernens der zwei Boxen.
