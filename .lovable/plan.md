# Warnkarte-Widget: Höhe passt sich automatisch an

Ziel: `/embed/widget-warnungen` soll sich in einem WordPress-Widget selbst an die verfügbare Breite/Höhe anpassen, statt eine feste Kartenhöhe (340 px mobil / 600 px ab Tablet) zu erzwingen.

## Was sich ändert

1. **Karte skaliert mit der Breite (Widget-Modus)**
   - In `src/components/maps/warn-map.tsx` erhält der Kartencontainer im Widget-Modus (`snapshot`) statt der fixen Höhen ein Breitenverhältnis (ca. 4:3, mit `min-h-[240px]` und `max-h-[520px]`), damit die Karte in schmalen Sidebar-Spalten niedrig und in breiten Spalten grösser dargestellt wird.
   - Karteninhalt (Zentrum/Bounds) wird nach Grössenänderung neu eingepasst: `map.invalidateSize()` plus `fitBounds` über einen ResizeObserver, damit der Oberthurgau immer vollständig sichtbar bleibt.
   - Normales Embed `/embed/warnungen` und die App-Seiten bleiben unverändert.

2. **Snippet mit Auto-Höhe**
   - In `src/routes/embed-info.tsx` bekommt der Eintrag „Widget: Warnungen aktuell“ die Variante `auto-height` (eigene `frameId`, Starthöhe ca. 320 px, `minHeight` 240) — das iframe wächst/schrumpft dann anhand der vom Widget gemeldeten Höhe, inklusive der bestehenden Anti-Shrink-Logik.
   - Beschreibung wird angepasst: „passt die Höhe automatisch an“.

3. **Höhenmeldung**
   - `EmbedShell` (ohne `fillViewport`) meldet die Höhe schon per `postMessage`; die Widget-Route nutzt diese Variante bereits, daher keine Änderung nötig. Nach dem Karten-Resize löst der ResizeObserver eine erneute Meldung aus.

## Nicht im Scope

- Keine Änderung an Warnlogik, Daten, Push oder Backend.
- Kein Umbau der übrigen Embeds/Widgets (Radar, Wind, Region).

## Hinweis

Das Snippet muss nach dem Umbau in WordPress neu kopiert werden, da die Höhenlogik im Snippet steckt.
