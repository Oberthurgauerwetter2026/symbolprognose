# Standbilder für Wind, Radar, Warnungen als WP-Snippets

## Ziel

Drei Bild-Endpunkte, die jeweils ein aktuelles Standbild (kein iframe, kein JavaScript) der Karte liefern — einbindbar als einfaches `<img>` in einem WordPress-Widget, klickbar auf die interaktive Karte.

## Was gebaut wird

1. **Echte Standbilder statt Platzhalter**
   Der bestehende Endpunkt `/api/public/snapshot/{map}.svg` liefert für `radar` und `wind` heute nur ein Platzhalter-Bild und kennt `warnungen` gar nicht. Neu:
   - `warnungen`: Thurgau-Umriss mit allen Gemeinden, gefüllt nach aktueller Warnstufe (Grün/Stufe 1–3, Vorinformation schraffiert), Titelzeile mit Anzahl aktiver Warnungen und Zeitstempel (Europe/Zurich).
   - `radar`: aktuellstes Radar-Messbild (PNG aus dem bestehenden Cache) als Bild-Layer in das SVG eingebettet, darüber Kantonsumriss, Referenzorte und Zeitstempel des Frames.
   - `wind`: aktuelles Windfeld als Pfeil-/Barb-Symbole an den Referenzorten plus Böenspitze in km/h, gleiche Rahmenoptik wie die anderen Standbilder.
   - Einheitliche Bildmarke: Titelpille oben links, Fusszeile mit Quellenangabe und „Stand HH:MM“.

2. **Caching**
   Jeweils kurze Browser-Cache-Zeit und 5 Minuten Edge-Cache mit `stale-while-revalidate` (wie heute), damit WordPress-Besucher schnell ein Bild sehen und es sich trotzdem regelmässig erneuert.

3. **Snippets in `/embed-info`**
   Drei neue Einträge „Standbild Radar“, „Standbild Wind“, „Standbild Warnungen“ mit Copy-Snippet in der Form:
   verlinktes `<img>` mit `width:100%`, `alt`-Text, `loading="lazy"` und einem Cache-Buster-Parameter, der pro 5-Minuten-Fenster wechselt — inklusive Kurzhinweis, dass das Bild ohne JavaScript funktioniert und sich automatisch aktualisiert.

## Technische Hinweise

- Erweiterung von `src/lib/snapshot.server.ts` (neue Builder `buildWarnSnapshotSvg`, `buildRadarSnapshotSvg`, `buildWindSnapshotSvg`) und `src/routes/api/public/snapshot/$map.ts` (neue Cases, `warnungen` ergänzt).
- Datenquellen serverseitig, bereits vorhanden: `readActiveWarnings` / `warnings-lookup` für Regionen, der Radar-/Open-Meteo-Cache für das jüngste Radar-PNG, Open-Meteo für Wind an den Referenzorten (`src/data/reference-cities.ts`, `src/data/spots.ts`).
- Radar-PNG wird als Data-URL in das SVG eingebettet, damit das Bild in WordPress ohne Zusatz-Requests und ohne CORS-Probleme rendert.
- Fällt eine Quelle aus, wird der bestehende Platzhalter mit Hinweistext ausgeliefert (kein Fehlerbild).
- Änderung in `src/routes/embed-info.tsx`: neue Snippet-Variante `buildImageSnippet` plus drei Produkteinträge. Keine Änderungen an Datenbank, Ingest oder den interaktiven Karten.

## Prüfung

- Die drei URLs direkt im Browser öffnen: aktuelles Bild, korrekter Zeitstempel, keine leeren Flächen.
- Snippet in einer Test-HTML-Seite einbinden: Bild skaliert auf Widget-Breite, Klick öffnet die interaktive Karte in neuem Tab.
- Mit deaktiviertem JavaScript prüfen, dass das Bild weiterhin erscheint.
