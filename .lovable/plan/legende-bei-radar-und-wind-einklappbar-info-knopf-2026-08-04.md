# Legende bei Radar und Wind einklappbar (Info-Knopf)

## Empfehlung

Gleiches Muster wie in der Warnkarte: standardmässig nur ein kleiner runder „i"-Knopf, auf Klick öffnet sich die Legende, mit „X" wieder zu. Das ist auf dem Handy die klar bessere Variante — die Radarlegende (mm/h + Schnee + Hagel) verdeckt aktuell dauerhaft einen grossen Teil der Karte oben rechts. Ein reines „Aufklappen" ohne Schliessen-Knopf wäre die halbe Lösung; der Warnkarten-Stil ist konsistent mit dem Rest der App.

## Verhalten

- Geschlossen: 32-px-Kreis mit „i", halbtransparent, an derselben Stelle wie die heutige Legende (oben rechts unter den Zoom-Buttons).
- Offen: die bekannte Legende in einer Karte mit Titel („mm/h" bzw. „Böen km/h") und Schliess-Knopf oben rechts.
- Startzustand geschlossen, auch im Embed/bare-Modus. Zustand hält nur, solange die Karte offen ist.
- Inhalte bleiben unverändert: Radar = mm/h-Skala, Schnee, Hagel (POH); Wind = Böen-Skala.

## Technische Umsetzung

- `src/components/maps/radar-map.tsx` (Legendenblock ab ~Zeile 2175) und `src/components/maps/wind-map.tsx` (ab ~Zeile 1132):
  - je ein `const [legendOpen, setLegendOpen] = useState(false)`.
  - Bestehendes Legenden-Markup in den `legendOpen`-Zweig verschieben, `pointer-events-none` entfernen und Kopfzeile mit `X`-Button (`lucide-react`) ergänzen.
  - Else-Zweig: `Info`-Button, Klassen 1:1 vom Warnkarten-Button (`h-8 w-8 rounded-full bg-card/50 …`), Position `absolute right-3 top-24 z-[400]`.
- Keine Änderungen an Skalen, Daten oder Filmstrip.
