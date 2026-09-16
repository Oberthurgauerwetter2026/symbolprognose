# Widerspruch „Regen-Symbol, aber trocken" in der Stunden-Übersicht beheben

## Befund

In der kompakten Ansicht „Nächste Stunden" (und ggf. der ausführlichen Stundenprognose) kann ein Feld ein Regensymbol zeigen, darunter steht aber „trocken".

Ursache in `src/components/weather-widget.tsx` (`CompactHourlyStrip`, ca. Zeile 763–785):

- Das Symbol kommt aus `h.weathercode[idx]` – ein Regencode erzeugt das Regensymbol.
- Der Text darunter prüft nur `h.precipitation[idx] > 0`. Ist die Menge 0 (oder fehlt / wurde vom Bereinigungsfilter auf 0 gesetzt), steht „trocken" – obwohl das Symbol Regen zeigt.

Symbol und Text kommen also aus zwei verschiedenen Datenquellen und können sich widersprechen.

## Änderung

Der Statustext richtet sich nach dem, was das Symbol zeigt – nicht nur nach der mm-Zahl:

1. In `CompactHourlyStrip` (und analog in der ausführlichen Stundenleiste, falls dort dieselbe Logik vorkommt) wird geprüft, ob der Wettercode ein Niederschlagssymbol darstellt.
2. Logik für den Text:
   - `precipitation > 0` → weiterhin „x.x mm" anzeigen.
   - Niederschlags-Symbol, aber keine messbare Menge → statt „trocken" einen passenden Kurztext zeigen, z. B. „leicht" bzw. die Regenwahrscheinlichkeit in % (falls im Datenfeed vorhanden, z. B. „30 %").
   - Kein Niederschlags-Symbol und keine Menge → „trocken" wie bisher.
3. Umgekehrt absichern: Ist die Menge > 0, zeigt das Symbol bereits Regen – kein Fall, in dem „trocken" unter einem Regensymbol stehen kann.

## Nicht geändert

- Symbole, Farben, Tropfenanimation, Layout und Höhen bleiben unverändert.
- Keine Änderung an Ingest-Skripten oder Datenquellen.

## Technische Details

- `src/components/weather-widget.tsx`: `CompactHourlyStrip` (ca. Z. 740–794) – Textlogik an den gerenderten Symboltyp koppeln; Niederschlagserkennung am Wettercode über die vorhandene Icon-/Code-Klassifizierung (WMO-Codes ≥ 51 bzw. die bestehende Regen-/Schnee-/Gewitter-Erkennung in `weather-icons`).
- Prüfen, ob die ausführliche Stundenleiste dieselbe „trocken"-Logik verwendet, und sie gleich mitziehen.
- Verifikation: Build/Typecheck plus Browser-Check auf `/karten/lokal` mit einer Stunde, deren Code nass, deren Menge 0 ist.
