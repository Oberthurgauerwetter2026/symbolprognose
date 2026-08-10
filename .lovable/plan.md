# Blitze im Niederschlagsradar

Ja, das ist möglich. Das Radar hat aktuell keine Blitzdarstellung — die frame-basierte Blitz-Anzeige (gelb → orange → dunkelrot, dann weg) existiert nur im Satellitenbild.

## Was gebaut wird

- Neuer Blitz-Button im Radar (gleiches Icon/Verhalten wie im Satellitenbild), Zustand wird in `localStorage` gemerkt.
- Blitze erscheinen passend zum aktuell angezeigten Zeitschritt des Filmstrips und altern mit: 0–2 Min hellgelb, 2–8 Min orange, 8–15 Min dunkelrot, danach ausgeblendet.
- In Prognose-Frames (Zukunft) werden keine Blitze gezeigt — nur im Messbereich, wo echte Daten existieren.
- Hinweis „keine aktiven Blitze“ wenn die Ebene aktiv ist, aber im gewählten Zeitschritt nichts vorliegt.
- Legende/Quellenangabe erhält den Eintrag Blitzortung.org.

## Technisch

- `LightningLayer` aus `src/components/maps/satellite-map.tsx` in eine gemeinsame Komponente `src/components/maps/lightning-layer.tsx` auslagern (Alters-Berechnung relativ zur übergebenen Frame-Zeit bleibt unverändert), Satellitenbild importiert sie danach von dort.
- In `src/components/maps/radar-map.tsx`: `getLightningStrikes` per `useQuery` (nur wenn Ebene aktiv), eigene Leaflet-Pane über dem Niederschlag, Frame-Zeit aus der bereits vorhandenen kontinuierlichen Anzeigezeit (`scrubVisualMs`/`playVisualMs`/`renderMs`, Fallback `currentFrame.t`), damit die Alterung beim Scrubben und Abspielen flüssig mitläuft.
- Blitze nur rendern, wenn die angezeigte Zeit nicht nach dem letzten Messframe (`source === "radar"`) liegt.
- Keine Backend-Änderung nötig; das rollierende 6-Stunden-Archiv `lightning/recent.json` wird weiterverwendet.
