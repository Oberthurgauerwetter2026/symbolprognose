# Tropfen im Tagessymbol bei trockener Mehrheit entfernen

## Befund (live geprüft)

Münsterlingen, heute (13.09.): Stundenprognose 05–16 Uhr durchgehend trocken (0 mm), nur am Abend 2–3 nasse Stunden mit insgesamt 0,4 mm. Trotzdem zeigt die Tageskachel Sonne+Wolke mit Regentropfen. Ursache ist eine ältere Sonderregel in den beiden Symbol-Renderern: „Jeder Niederschlag im Tagesfenster muss sichtbar sein" (`dayHasRain`: ab 1 nasser Stunde oder 0,5 mm wird ein Regensymbol erzwungen). Diese Regel sitzt hinter der neuen Mehrheitsregel und überstimmt sie – sie widerspricht damit der Vorgabe „bei trockener Mehrheit kein Regen im Tagessymbol".

## Was geändert wird

1. **`src/components/weather-icons/index.tsx`**
   - Die Tages-Sonderregel `dayHasRain` (ca. Zeile 668–674) darf nicht mehr feuern, wenn die Niederschlagsstunden bekannt sind und unter 8 liegen (trockene Mehrheit). In dem Fall greift ausschliesslich das trockene Symbol aus der Mehrheitsregel.
   - Nur wenn die Stundenzahl gar nicht übergeben wurde (alte Aufrufe), bleibt das bisherige Verhalten als Rückfall bestehen.

2. **`src/lib/weather-icon-svg.server.ts`**
   - Dieselbe Korrektur spiegeln (ca. Zeile 400–404), damit statische Einbettungen und die Website identisch aussehen.

3. **Nicht geändert**
   - Stundenprognose (bleibt stundengenau, auch 0,2 mm sichtbar).
   - Niederschlagsmenge (mm) und Regenrisiko (%) in den Tageskacheln bleiben stehen – die Information „abends kurz 0,4 mm" geht also nicht verloren, nur das Tropfen-Symbol verschwindet.
   - Nasstag-Regeln: Ab 8 nassen Tagesstunden (bzw. 6 Stunden mit deutlicher Menge) bleibt das Regen-/Schauer-/Gewittersymbol wie bisher.

## Prüfung

- Münsterlingen heute: Tageskachel zeigt Sonne/Wolke ohne Tropfen, die 0,4 mm und 90 % bleiben sichtbar.
- Ein Tag mit überwiegend nassem Verlauf zeigt weiterhin Regen.
- Regionskarte und Embed-Ansichten zeigen dasselbe Symbol wie die Lokalprognose.
- Build und Typecheck fehlerfrei.
