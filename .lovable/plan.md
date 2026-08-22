# Warnkarte-Embed: nur Karte, ganzer Klick auf die WP-Warnseite

## Ziel

Beide Warn-Embeds (`/embed/warnungen` und `/embed/widget-warnungen`) zeigen ausschliesslich die Karte mit den aktuellen Warnungen. Kein Info-Panel, keine Gefahren-Leiste, kein Abo-Block, keine Legende-Liste. Ein Klick irgendwo im Embed öffnet `https://www.oberthurgauerwetter.ch/warnkarte/` im übergeordneten Fenster (nicht im iframe).

## Verhalten

- Nur die Karte mit den eingefärbten Gemeinden (inkl. Schraffur für Vorinformationen) und der kleinen Legende-Schaltfläche „i“ bleibt sichtbar.
- Die Karte füllt die volle Breite des Embeds; die Höhe bleibt wie heute (mobil kompakt, Desktop grösser).
- Klick/Tap auf die Karte: Weiterleitung auf die WP-Warnseite im Top-Fenster. Zeigerhand als Hinweis.
- Karte im Embed ist nicht mehr interaktiv im Sinne von Regionsauswahl (kein Panel dahinter, das sich öffnen könnte) — jeder Klick führt zur WP-Seite.
- Die App-Seiten `/karten/warnungen` und `/warnkarte` bleiben unverändert mit Panel, Filtern und Abo.

## Technische Details

- `src/components/maps/warn-map.tsx`
  - Neue Prop `linkOnly?: boolean` (bzw. Verhalten an `bare || snapshot` gekoppelt, entschieden über eine gemeinsame Konstante `embedMode`).
  - Im Embed-Modus: rechte Panel-Spalte und Gefahren-Leiste nicht rendern, Grid auf eine Spalte; Push-/Abo-Block entfällt bereits über `!snapshot` und wird ebenfalls ausgeschlossen.
  - Klick-Overlay: transparentes `<a href={WP_WARN_URL} target="_top">` über dem Kartencontainer (oberhalb der Leaflet-Panes, unterhalb der Legende-Schaltfläche), damit jeder Klick greift; Karten-Interaktionen (Drag/Zoom) im Embed deaktivieren, damit das Overlay nicht mit Leaflet konkurriert.
  - Region-Klick-Handler und `selected`-Logik im Embed-Modus nicht aktivieren.
- `src/routes/embed.warnungen.tsx` und `src/routes/embed.widget-warnungen.tsx`: unveränderte Props (`bare`, `bare snapshot`) genügen; nur die Komponente ändert ihr Embed-Verhalten.
- Keine Änderungen an Warnlogik, Daten, Push oder Backend.
