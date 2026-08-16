# Blitze in Satellit und Radar vorübergehend abschalten

## Ziel

Blitze werden in beiden Karten (Satellitenbild, Niederschlagsradar) nicht mehr angezeigt, der Zap-Schalter verschwindet aus der Bedienleiste, und es werden keine Blitzdaten mehr abgefragt. Die Blitz-Logik bleibt im Code erhalten, damit sie später mit einem einzigen Schalter wieder aktiviert werden kann.

## Vorgehen

1. Ein zentrales Feature-Flag `LIGHTNING_ENABLED = false` (in `src/components/maps/lightning-bolt.ts`, wo die Blitz-Grafik ohnehin liegt).
2. Satellitenbild (`src/components/maps/satellite-map.tsx`):
   - Zap-Button in der Steuerleiste nur rendern, wenn das Flag aktiv ist.
   - `showLightning` effektiv auf `false` zwingen, solange das Flag aus ist — dadurch entfallen automatisch der `LightningLayer`, die Blitzortung-Quellenangabe und die Datenabfrage (`enabled: false`).
   - `lightningInitiallyActive` im Loop-Embed bleibt unverändert bestehen, wirkt aber nicht, solange das Flag aus ist.
3. Radar (`src/components/maps/radar-map.tsx`):
   - Gleiche Behandlung: Zap-Button ausgeblendet, `showLightning` effektiv `false`, `RadarLightningLayer` und die Blitz-Abfrage inaktiv, Blitzortung-Hinweis in der Quellenzeile entfällt.
4. Datenpipeline (Blitzortung-Ingest, Cron, Tabelle) bleibt unangetastet — es wird nur nichts mehr angezeigt.

## Wieder-Aktivierung

Später genügt `LIGHTNING_ENABLED = true`; alle Layer, Schalter und Quellenangaben erscheinen wieder wie zuvor.
