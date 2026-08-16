# Region-Embed: Lokalprognose vollständig wie im Original

## Problem

Nach dem Klick auf eine Gemeinde rendert `/embed/region` die Lokalprognose im `detailOnly`-Modus. Der zeigt nur das Stundenpanel — die Tageskacheln (5/7 Tage), die Tages-Zusammenfassung, Fussleiste und Datenstempel fehlen.

## Ziel

Nach dem Klick erscheint die komplette Lokalprognose wie auf `/karten/lokal` — Tageskacheln inklusive 7-Tage-Ansicht, Tagesbalken, Stundenverlauf, Fussleiste — nur ohne Wetterboard-Rahmen (keine Sidebar, keine Kopfzeile der Seite, keine Kartenreiter).

## Umsetzung

1. `src/routes/embed.region.tsx`
   - `WeatherWidget` ohne `detailOnly` einsetzen, mit `lockedLocation` des angeklickten Orts und `compact` für schlanke Innenabstände.
   - Damit erscheinen `DayStrip` (Tageskacheln), `DaySummaryBar`, `DetailPanel`, `Footer` und Datenstempel wie im Original.
   - „Zurück zur Karte“-Button und Ortsname bleiben als schmale Zeile darüber.

2. `src/components/weather-widget.tsx`
   - Neue optionale Prop `initialExtended?: boolean`, die den Startwert von `extended` setzt (Standard unverändert `false`), damit das Embed direkt mit der 7-Tage-Kachelreihe startet.
   - Der bestehende Widget-Header (Ortssuche, „7 Tage“- und Schnee-Umschalter) bleibt erhalten, damit die Kacheln sich wie im Original bedienen lassen. Keine weiteren Verhaltensänderungen.

3. Prüfung
   - Embed im Browser aufrufen, Gemeinde anklicken und per Screenshot bestätigen, dass Tageskacheln (7 Tage), Tagesbalken und Stundenverlauf sichtbar sind und die Auto-Höhe im Snippet passt.
