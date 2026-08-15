# Blitzortung-Attribution verlinken

Ziel: Die Blitzdaten-Quelle wird überall dort, wo sie genannt wird, als klickbarer Link auf blitzortung.org geführt — das ist die Bedingung für die kostenlose, nicht-kommerzielle Nutzung.

## Änderungen

1. **Niederschlagsradar** — in der Quellenzeile unter der Karte wird „Blitzortung.org (Blitze)" ein Link auf `https://blitzortung.org` (neuer Tab, `rel="noopener noreferrer"`, dezent unterstrichen, gleiche Textgrösse/Farbe wie bisher).
2. **Radar-Legende** („Blitze → Blitzortung") — gleicher Link, damit die Angabe auch im aufgeklappten Info-Panel zur Quelle führt.
3. **Satellitenbild** — die Quellenzeile nennt bisher nur die Bildquelle. Solange Blitze angezeigt werden, wird „· Blitze: Blitzortung.org" ergänzt, ebenfalls als Link. Im Loop-/Embed-Modus ohne Quellenzeile wird die Angabe als kleine, unauffällige Zeile unter der Karte eingeblendet, sofern der Blitz-Layer aktiv ist (Attribution ist im Embed Pflicht).
4. **Nicht-kommerzieller Hinweis** — in der Datenquellen-Übersicht im Admin-Bereich wird zur Blitz-Pipeline ein kurzer Vermerk ergänzt: „Blitzortung.org: gratis, nur nicht-kommerzielle Nutzung, Attribution mit Link erforderlich."

Keine Änderung an Ingest, Datenlogik oder Layer-Verhalten — rein Darstellung und Verlinkung.

## Technische Details

- Betroffene Dateien: `src/components/maps/radar-map.tsx` (Quellenzeile ~Z. 2633, Legende ~Z. 2396), `src/components/maps/satellite-map.tsx` (Quellenzeile ~Z. 887 plus Attributionszeile für `loop`/`bare`), `src/routes/admin.tsx` (Datenquellen-Abschnitt).
- Link-Styling über bestehende Tokens (`text-muted-foreground`, `underline underline-offset-2 hover:text-foreground`) — keine hartcodierten Farben.
- Der Fallback-String `"Blitze: Blitzortung.org"` in `src/lib/lightning.functions.ts` bleibt als Rohtext unverändert; verlinkt wird in der UI.
