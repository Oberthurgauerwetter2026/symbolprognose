# Blitze im Niederschlagsradar (kurzes Aufglühen)

Blitze wie im Satellitenbild einblenden — aber nicht als bleibender Punkt, sondern als kurz aufglühender Blitz, der beim nächsten Zeitschritt wieder verschwindet.

## Verhalten

- Ein Blitz erscheint genau in dem Zeitschritt, in den sein Zeitstempel fällt.
- Darstellung: kurzer Glow-Aufblitz (heller Kern + weicher Halo), der innerhalb des Schritts schnell abklingt — beim nächsten Frame ist er weg. Keine Alterungsfarben wie beim Satellitenbild.
- Beim Abspielen "blinkt" es damit im Rhythmus der Timeline; beim Scrubben zeigt jeder Zeitschritt genau seine Blitze.
- Nur im Messteil der Timeline (Vergangenheit). Im Prognoseteil gibt es keine Blitzdaten — dort wird die Ebene ausgeblendet.
- Ein-/Ausschalten über einen eigenen Blitz-Button neben den bestehenden Karten-Schaltern; Auswahl wird lokal gespeichert.
- Legende erhält einen Eintrag „Blitze (Blitzortung)“; Quellenangabe wird ergänzt.

## Technisch

- Datenquelle: bestehende `getLightningStrikes` (rollierendes 6-h-Archiv aus R2), per `useQuery` nur laden, wenn der Layer aktiv ist.
- Neue Komponente `RadarLightningLayer` in `src/components/maps/radar-map.tsx` (eigene Leaflet-Pane über den Niederschlags-Overlays, `pointerEvents: none`).
- Zeitfenster pro Frame aus der bestehenden Timeline ableiten: Blitz sichtbar, wenn `strikeT` im Intervall `[stepMs, stepMs + stepGap)` des aktuellen Zeitschritts liegt (Mess-Schritt = 5 min).
- Aufglüh-Effekt über die schon vorhandene kontinuierliche Renderzeit (`scrubVisualMs ?? playVisualMs ?? renderMs`): Deckkraft/Radius fallen über die ersten ~40 % des Schritts von 1 auf 0 ab, danach unsichtbar. Marker werden bei jedem gedrosselten Flush neu gezeichnet (gleiches Muster wie der bestehende Hagel-Layer), keine zusätzliche Animationsschleife.
- Kein Backend-, Ingest- oder Datenmodell-Änderung nötig.
