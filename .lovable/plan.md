Ich würde die Tagesicon-Logik an zwei Stellen nachschärfen:

1. `src/lib/weather.ts`
   - Die Tages-WMO-Auswahl nicht mehr rein über den „nasseren“ Modus entscheiden lassen.
   - Für kurze Niederschlagsphasen mit Sonne gezielt einen Schauer-Code bevorzugen, statt `Drizzle/Regen` zu behalten.
   - Gleichzeitig bei trockenen Tagen mit wenigen Wolken nicht automatisch `Sonne` wählen, sondern anhand von Wolkenanteil/Sonnenanteil eher `mostly clear` oder `partly cloudy` setzen.

2. `src/components/weather-icons/index.tsx`
   - Bei Tages-Wet-Codes (`51–67`, `80–82`) mit Sonne und begrenzten Niederschlagsstunden konsequent `IconSunShower` anzeigen.
   - Reinen Regen/Drizzle nur zeigen, wenn Niederschlag den Tag wirklich prägt: viele Regenstunden, wenig Sonne oder größere Mengen.
   - Den Sonnen-Override entschärfen: `code 2/3 + viel Sonne` darf nicht mehr zu `IconClear` werden, sondern maximal zu `IconMostlyClear` bzw. `IconPartlyCloudy`.

3. Erwartetes Ergebnis
   - „Sonne + Nachmittagsschauer“ wird als Sonnen-Schauer angezeigt, nicht als Drizzle/Regen.
   - „Sonne + wenige Wolken“ bleibt sichtbar leicht bewölkt, nicht einfach wolkenlos sonnig.
   - Echte Regentage bleiben Regen/Drizzle.