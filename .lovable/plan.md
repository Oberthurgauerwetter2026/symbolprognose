# Strassenglätte-Symbol exakt nach Vorlage zeichnen

Das Glätte-Symbol wird 1:1 nach dem hochgeladenen Referenzbild neu gezeichnet: Auto in Frontansicht (Dachlinie, Windschutzscheibe, Kotflügel-Spiegel links/rechts, Nummernschild-Rechteck, Stossstange-Linie, zwei Radansätze unten) und darunter zwei getrennte Schlängel-Spuren (S-Kurven), die die Rutschspuren darstellen.

## Umsetzung

1. `src/components/warnings/hazard-svg.ts`: Die Konstante `SLIPPERY` wird durch neue Geometrie ersetzt, die die Vorlage nachzeichnet:
   - Karosserie-Kontur als offene, gerundete Pfadlinie (Motorhaube + Dach mit Windschutzscheibe als separater Trapez-Linie)
   - zwei kleine Spiegel-Ausleger seitlich
   - Nummernschild als kleines gerundetes Rechteck
   - eine horizontale Stossstangen-Linie
   - zwei kurze Radaufstandsstriche unten links/rechts
   - zwei separate Schlängelspuren unter dem Auto (jeweils zwei Bögen, unterschiedlich versetzt wie in der Vorlage)
   - Umsetzung als reine Strichzeichnung (`fill="none"`, runde Enden), damit sie auf Gelb, Orange und Rot gleich gut wirkt

2. Die Proportionen werden so gesetzt, dass Auto ca. oberste zwei Drittel und Spuren das untere Drittel der 24×24-Box füllen. Die Strichstärke wird leicht reduziert (ca. 1.7), weil das Motiv mehr Details als die übrigen Symbole hat.

3. Rendering-Kontrolle: Symbol wird in allen drei Warnstufen gerendert und visuell geprüft; danach ggf. Feinabgleich der Kurven.

4. Push-Icons neu generieren (`scripts/gen-warn-icons.ts` + Rasterung) und die PNGs in `public/warn-icons/` aktualisieren, damit Karte, Legende, Admin-Tool und Pushmeldungen dasselbe Symbol zeigen.

## Hinweis

Da es eine Hand-Nachzeichnung in Vektorform ist, folgt nach dem ersten Rendering eine Feinjustierung — kleine Abweichungen bei den Schlängelkurven korrigiere ich direkt anhand des gerenderten Ergebnisses.
