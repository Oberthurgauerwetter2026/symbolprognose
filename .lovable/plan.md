## Ziel

Die Warn-Beschreibungen (`description` in `TEMPLATES`, `src/lib/warnings-config.ts`) werden auf kurze, sachliche Wetterdienst-Formulierungen umgestellt – ein knapper Satz statt Fliesstext. Auswirkungen (`impact`) und Verhaltenshinweis (`advice`) bleiben inhaltlich wie bisher, da sie separate Felder sind.

## Neue Beschreibungen (Stufe 1 / 2 / 3)

**Regen**
1. Mässiger Dauerregen{, Mengen 30 mm}.
2. Kräftiger Dauerregen{, Mengen 60 mm}.
3. Sehr ergiebiger Dauerregen{, Mengen 100 mm}.

**Schnee**
1. Mässiger Schneefall{, Neuschnee 5 cm}.
2. Kräftiger Schneefall{, Neuschnee 15 cm}.
3. Intensiver Schneefall mit Verwehungen{, Neuschnee 40 cm}.

**Wind**
1. Kräftige Windböen{ bis 65 km/h}, in exponierten Lagen stärker.
2. Starke bis stürmische Windböen{ bis 90 km/h}.
3. Schwere Sturm- bis Orkanböen{ bis 120 km/h}.

**Gewitter**
1. Örtlich Gewitter mit kurzem Starkregen{ und Böen bis 65 km/h}.
2. Kräftige Gewitter mit Starkregen, Hagel{ und Sturmböen bis 90 km/h}.
3. Schwere Gewitter mit heftigem Starkregen, grossem Hagel{ und Böen bis 120 km/h}.

**Strassenglätte**
1. Örtlich Glätte durch gefrierende Nässe, vor allem auf Brücken und in Senken{, um -2 °C}.
2. Verbreitet Glatteis{, um -5 °C}.
3. Grossflächige Vereisung von Strassen und Wegen{, um -8 °C}.

**Frost**
1. Leichter Frost{, Tiefstwerte -2 °C}.
2. Mässiger Frost{, Tiefstwerte -6 °C}, örtlich Reifglätte.
3. Strenger Frost{, Tiefstwerte -12 °C} über mehrere Stunden.

Die `{v: …}`-Platzhalterlogik bleibt unverändert: der Messwert-Baustein erscheint nur, wenn im Admin-Tool ein Wert bzw. eine von/bis-Spanne eingetragen ist.

## Technisch

- Änderung ausschliesslich an den `description`-Strings in `TEMPLATES` (`src/lib/warnings-config.ts`); Struktur, Typen und Feldnamen bleiben gleich.
- Titel-Generierung, `genTexts`, die `lastTpl`-Logik im Admin-Tool und bestehende, bereits veröffentlichte Warnungen bleiben unberührt. Manuell überschriebene Texte werden weiterhin nicht automatisch ersetzt.
- Kurzprüfung im Admin-Tool (`/admin-warnungen`): Gefahr/Stufe durchschalten und die generierten Beschreibungen sowie die Anzeige in Karte/Banner gegenlesen.
