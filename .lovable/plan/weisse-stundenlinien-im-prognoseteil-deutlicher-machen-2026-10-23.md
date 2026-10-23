# Weisse Stundenlinien im Prognoseteil deutlicher machen

## Befund
In der Vorschau sind die weissen Stundenlinien auch im blauen Prognoseteil zu sehen (bei 20:00 und 21:00 geprüft). Auf der veröffentlichten Seite fehlen sie, solange die Änderung noch nicht veröffentlicht ist. Auf dem blauen Band sind sie ausserdem eher schwach zu erkennen.

## Was sich ändert
- Die Stundenlinien werden etwas länger: Sie reichen über das Farbband hinaus nach oben und unten.
- Sie sind 2 px breit, reinweiss und haben einen feinen dunklen Rand. So sind sie auf Blau und Grau gleich gut zu sehen.
- Auf der Prognose werden die Viertelstunden-Striche noch dezenter, damit die Stunde klar hervorsticht.
- Danach wird auf dem Handy geprüft, auch weit hinten in der Prognose (+12 h, +24 h).
- Hinweis an dich: Auf der veröffentlichten Seite erscheint das erst nach dem Veröffentlichen.

## Technische Details
- `src/components/maps/filmstrip-timeline.tsx`: Der Stunden-Strich bekommt `top-5 h-6 w-[2px]` und einen kräftigeren Schatten. Er wird nach den Bändern gezeichnet und bekommt `z-10`. Die Zwischenticks gehen auf `bg-white/35`.
- Mit Playwright bei 402 px Breite und dpr 3 prüfen, wie der Strip an mehreren Prognosepositionen aussieht.
