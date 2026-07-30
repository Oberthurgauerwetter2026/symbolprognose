## Ziel

Beschreibungen im Stil von MeteoSchweiz/SRF Meteo: ein kurzer Ereignissatz, danach ein Mengensatz mit Spanne und Zeitraum. Auswirkungen kurz und sachlich, ohne Dramatisierung, durchgehend Schweizer Hochdeutsch (ss statt ß).

Beispiel: «Kräftiger Regen. Erwartete Mengen 30 bis 50 mm in 12 Stunden.»

## Textaufbau

- Satz 1: Ereignis + Intensität (Stufe 1/2/3), ohne Messwert.
- Satz 2 (nur wenn Werte erfasst): «Erwartete Mengen 30 bis 50 mm in 12 Stunden.» / «Erwartete Böenspitzen 70 bis 90 km/h.» / «Erwartete Neuschneemengen 10 bis 20 cm in 12 Stunden.» / «Temperaturen um -5 °C.»
- Nur ein Wert erfasst: «Erwartete Mengen bis 50 mm in 12 Stunden.»
- Kein Wert erfasst: Satz 2 entfällt komplett.
- Die Stundenangabe wird automatisch aus «Gültig von/bis» berechnet (auf volle Stunden gerundet; über 48 h in Tagen). Bei Wind/Gewitter/Frost/Glätte wird keine Stundenangabe angehängt, dort ist der Spitzenwert massgebend.

## Neue Beschreibungen (Stufe 1 / 2 / 3)

Regen: Mässiger Regen. / Kräftiger Regen. / Sehr ergiebiger Dauerregen.
Schnee: Mässiger Schneefall. / Kräftiger Schneefall. / Intensiver Schneefall, teils mit Verwehungen.
Wind: Kräftige Windböen. / Starke bis stürmische Windböen. / Sturm- bis Orkanböen.
Gewitter: Örtlich Gewitter. / Kräftige Gewitter mit Starkregen und Hagel. / Schwere Gewitter mit Starkregen, Hagel und Sturmböen.
Glätte: Örtlich Glätte durch gefrierende Nässe, vor allem auf Brücken und in Senken. / Verbreitet Glatteis. / Grossflächige Vereisung von Strassen und Wegen.
Frost: Leichter Frost. / Mässiger Frost, örtlich Reifglätte. / Strenger Frost.

## Auswirkungen und Verhalten

Auswirkungen auf ein bis zwei knappe Sätze kürzen und an die Gefahrenstufe angleichen (Stufe 1 = geringe Behinderungen, Stufe 2 = lokale Schäden/Behinderungen, Stufe 3 = verbreitete Schäden). Formulierungen wie «erhebliche Gefahr», «Notgepäck bereithalten», «Gebäude nicht verlassen» werden auf sachliche Varianten zurückgenommen. Verhaltenshinweise bleiben ein bis zwei Sätze.

## Technisch

- `src/lib/warnings-config.ts`: `TEMPLATES` neu formuliert; Beschreibungssatz 2 als Platzhalterblock, ergänzt um einen optionalen Zeitbaustein (z. B. `{h: in {h} Stunden}`), plus separate Behandlung «von–bis» vs. Einzelwert.
- `fillTemplate` erhält einen optionalen Dauer-Parameter (Stunden) und ersetzt/entfernt den `{h: …}`-Block analog zur bestehenden `{v: …}`-Logik. Bestehende Aufrufe ohne Dauer verhalten sich unverändert.
- `src/routes/admin-warnungen.tsx`: `genTexts` erhält zusätzlich die aus `validFrom`/`validTo` berechnete Dauer; Textsynchronisation (`lastTpl` / manuell überschrieben) bleibt unverändert, wird aber auch bei Änderung des Zeitraums neu ausgelöst.
- Anzeige in Karte, Banner und Push nutzt die gespeicherten Texte und bleibt unverändert; bereits veröffentlichte Warnungen werden nicht rückwirkend geändert.
- Prüfung im Admin-Tool: Gefahr, Stufe, Werte und Zeitraum durchschalten und die generierten Texte gegenlesen.
