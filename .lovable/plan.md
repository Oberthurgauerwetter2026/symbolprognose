# Hinweistext der Lokalprognose auf „7-Tage-Prognose“ ändern

## Ist-Zustand

Im Startzustand der Lokalprognose (noch kein Ort gewählt) steht im Hinweisfeld aktuell:

```text
Gemeinde suchen oder „Ortung" verwenden,
um die 5-Tage-Prognose anzuzeigen.
```

Die kompakte Embed-Variante zeigt stattdessen: „Gemeinde suchen oder „Ortung“ verwenden — die Prognose klappt danach auf.“

## Änderung

In `src/components/weather-widget.tsx` (Hinweisblock bei fehlendem Ort):

- Text auf „7-Tage-Prognose“ korrigieren.
- Typografische Anführungszeichen vereinheitlichen: „Ortung“ (bisher schliesst es mit einem geraden Zoll-Zeichen).
- Denselben Wortlaut auch für die kompakte Embed-Variante verwenden, damit beide Ansichten identisch sind:

```text
Gemeinde suchen oder „Ortung“ verwenden,
um die 7-Tage-Prognose anzuzeigen.
```

Nur Textanpassung — Layout, Logik und Datenabruf bleiben unverändert.
