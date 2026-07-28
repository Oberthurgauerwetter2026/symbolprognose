## 1. Kartenhintergrund identisch zu Radar/Wind

`src/components/maps/warn-map.tsx` nutzt zwar dieselbe swisstopo-Kachel, aber einen reduzierten Masken-Stack (nur eine Aussenmaske, keine Schweiz-Maske/-Kontur, andere Deckkraft). Der Layer-Aufbau wird 1:1 vom Wind-/Radar-Layout übernommen:

- Kachel-Deckkraft 0.6 → 0.55
- zusätzliche `OUTSIDE_CH_MASK` (Welt minus Schweiz/See) in `#3a4148`, Deckkraft 0.4
- bestehende `OUTSIDE_MASK` (Welt minus Region) auf `#5a6670`, Deckkraft 0.18
- See-Stil wie Radar (`#5ba8c8` / `#7ec8e3`, 0.25)
- weisse Schweizer Landesgrenze, Thurgau-Kontur 0.45, zusätzliche Region-Aussenkontur (`#1f4d80`, weight 2)
- gleicher Container-Hintergrund `#ebefeb`

Dazu werden `switzerland`-Geometrie und die Masken-Helfer analog zur Windkarte in der Warnkarte aufgebaut.

## 2. Neue Gefahren-Symbole

In `src/components/warnings/hazard-icons.tsx` (Lucide-Stil, 24×24, currentColor) neu bzw. ersetzt:

- **Gewitter**: ein einzelner, kräftiger Blitz (statt Wolke+Blitz)
- **Schnee**: drei Schneeflocken (eine grosse, zwei kleine)
- **Regen**: drei Regentropfen
- **Wind**: exakt derselbe Windsack wie in der Lokalprognose (`WindsockIcon` aus `weather-widget.tsx` wird in die gemeinsame Icon-Datei ausgelagert und an beiden Stellen verwendet — Darstellung in der Lokalprognose bleibt unverändert)
- **Strassenglätte**: modernere Variante — Fahrzeug in Schräglage mit zwei sauberen Schleuderspuren, weniger Detaillinien, klarere Silhouette

`src/lib/warnings-config.ts` referenziert die neuen Icons; Frost bleibt unverändert.

## 3. Mengenangaben „von/bis“

Im Admin-Formular (`src/routes/admin-warnungen.tsx`) wird das eine Wert-Feld durch zwei Felder („von“ / „bis“) ersetzt, mit Einheit aus der Gefahren-Definition (mm, cm, km/h, °C). Intern wird daraus ein Anzeigewert zusammengesetzt (`"20–40"`, oder nur `"40"` wenn nur ein Feld gefüllt ist) und wie bisher im bestehenden Feld gespeichert — keine Datenbankänderung nötig. Beim Bearbeiten wird ein gespeicherter Bereich wieder in die zwei Felder zerlegt.

## 4. Gültigkeit einfacher einstellen

Über den beiden Datum/Zeit-Feldern kommen Schnellwahl-Chips:

- Beginn: „Jetzt“, „+1 h“, „+3 h“, „Morgen 06:00“
- Dauer: „3 h“, „6 h“, „12 h“, „24 h“, „48 h“ (setzt „Gültig bis“ relativ zum Beginn)

Darunter eine Klartext-Vorschau („Gültig: 28.07. 14:00 – 20:00 Uhr“). Die manuellen Felder bleiben als Feineinstellung erhalten; Zeiten rasten auf 15 Minuten ein.

## 5. Standardisierte meteorologische Warntexte

`TEMPLATES` in `src/lib/warnings-config.ts` wird für alle 6 Gefahren × 3 Stufen neu formuliert, im Stil MeteoSchweiz/SRF Meteo:

- **Beschreibung**: sachliche Lagebeschreibung mit Kennwert-Bereich, z. B. „Verbreitet fällt Dauerregen mit Mengen von 40 bis 60 mm innerhalb von 24 Stunden.“
- **Auswirkungen**: nüchterne Aufzählung der wichtigsten Folgen, keine Dramatisierung („Lokale Überflutungen tiefliegender Strassen und Unterführungen sind möglich.“)
- **Verhalten**: kurze, neutrale Handlungsempfehlung
- Durchgehend kurze Hauptsätze, keine Umgangssprache, keine Ausrufezeichen, keine wertenden Adjektive; „von/bis“-Werte werden über die bestehende `{v: …}`-Platzhalterlogik eingesetzt.

## Technische Details

- Betroffene Dateien: `src/components/maps/warn-map.tsx`, `src/components/warnings/hazard-icons.tsx`, `src/components/weather-widget.tsx` (nur Icon-Import), `src/lib/warnings-config.ts`, `src/routes/admin-warnungen.tsx`
- Keine Migration, keine Änderung an Push-Versand oder Warn-API
- Abschliessend Typecheck und optische Prüfung von `/karten/warnungen` und `/admin-warnungen`
