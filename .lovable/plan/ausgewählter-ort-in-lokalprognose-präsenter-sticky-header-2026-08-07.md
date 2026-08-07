# Ausgewählter Ort in Lokalprognose präsenter + sticky Header

## Ziel

Der aktuell gewählte Ort in der Lokalprognose (`/karten/lokal`) soll deutlich stärker als heute hervortreten und beim Scrollen der Seite jederzeit sichtbar bleiben.

## Was gebaut wird

1. **Prägnante Orts-Badge**
   - In `src/components/weather-widget.tsx` wird die bisherige kleine Ort-Zeile unterhalb des Suchfelds (`⌖ Ortname`) durch eine markante Badge/Pill ersetzt.
   - Darstellung: abgerundete Pill mit Akzent-Hintergrund (`bg-accent` / `bg-primary`), weisser/heller Text, davor ein Standort-Pin-Icon.
   - Grössere Schrift (`text-lg`/`text-xl`), Fettschrift, ggf. mit einem dezentren Schatten, damit sie sofort als Seiten-Kontext erkennbar ist.
   - Die Badge bleibt funktional: kein Klick nötig, sie zeigt nur den aktiven Ort.

2. **Sticky Header**
   - Der `<header>`-Block im `Header`-Component wird `sticky top-0 z-20` und erhält einen festen Hintergrund, der mit dem Widget-Hintergrund (`bg-zinc-100`) übereinstimmt, damit Inhalt beim Scrollen nicht durchscheint.
   - Ein optionaler unterer Schatten oder Rahmen kann das Header-Band vom restlichen Inhalt abgrenzen.
   - Suche, Ortung, Karte-Button und die Schalter (Sonne/Schnee) bleiben im Header erhalten; auf kleinen Viewports weiterhin untereinander gestapelt, auf breiteren Viewports nebeneinander.

3. **Anpassung der Layout-Abstände**
   - Der untere `border-b` im Header bleibt erhalten; die übrigen Sektionen (Warn-Strip, Tagesleiste etc.) rutschen nicht hoch, solange der Header nicht gescrollt wird.
   - Die `pb-5` des Headers wird ggf. leicht reduziert, damit der sticky Header nicht zu viel vertikalen Raum einnimmt, wenn er am oberen Rand klebt.

## Technische Hinweise

- Betroffene Datei: `src/components/weather-widget.tsx` (nur das `Header`-Component).
- Keine Änderung an Datenquellen, Server-Funktionen oder Routing.
- Tailwind-only: Farben übernehmen die bestehenden semantischen Tokens (`bg-accent`, `text-accent-foreground`, `bg-zinc-100`, `border-zinc-200`).
- Keine neuen Abhängigkeiten.

## Prüfung

- Desktop- und Mobile-Ansicht der Lokalprognose öffnen, Ort wählen.
- Sicherstellen, dass der Ortsname als Badge klar lesbar ist und die Akzentfarbe kontrastreich wirkt.
- Scrollen testen: Header bleibt oben, Inhalt scrollt darunter.
- Prüfen, dass Suche, Ortung, Karte-Button und Schalter weiterhin bedienbar sind.
