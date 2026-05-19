## Änderungen am Wetter-Widget

Alle Änderungen ausschliesslich in `src/components/weather-widget.tsx`. Keine Anpassungen an Datenquellen oder API (`snowfall` ist bereits im Hourly-Datensatz vorhanden).

### 1. Schnee aus den 3h-Slots entfernen

In jedem Stunden-Slot (oben in der Detailprognose) wird die Zeile „Schnee … cm" entfernt. Wind/Böen bleibt als einzige Zusatzzeile unter der Temperatur.

### 2. Neuer Toggle „Schnee" im Header

Neben dem bestehenden „Sonnenschein"-Switch kommt ein zweiter Switch „Schnee".
- Neuer State `snow` in `WeatherWidget` (analog zu `extended`).
- Wird als Prop an `DayStrip` und `DetailPanel` weitergereicht.

### 3. Schnee-Balkendiagramm unterhalb (analog Sonnenschein)

Im `DetailPanel`, nur wenn `snow === true`:
- Eigene Y-Achsen-Spalte links (Skala 0 / 1 / 2 cm, Label `cm/3h`).
- Bar-Chart-Reihe unter dem Sonnenschein-Chart (bzw. unter Niederschlag, falls Sonne aus).
- Summe von `snowfall` über 3 Stunden, Farbe `--wx-snow` (neuer Token in `src/styles.css`, helles Blau-Weiss; falls noch nicht vorhanden, einmalig hinzufügen).
- Beschriftung unter dem Balken: Wert in cm + Sublabel `cm`.

### 4. Legenden unter den Grafiken

Direkt unter jedem Bar-Chart eine kleine Legendenzeile in `text-[10px] text-zinc-500`:
- Niederschlagschart: „Regenmenge in mm · Regenwahrscheinlichkeit in %"
- Sonnenscheinchart: „Sonnenscheindauer in min/h"
- Schneechart: „Neuschnee in cm"

Im Kopfbereich der Stunden-Slots zusätzlich der Hinweis „Wind / Böenspitzen in km/h" – ersetzt die bestehende rechte Sub-Headline `3-Stunden-Takt · °C / mm / km/h` durch eine klarere Variante:
`3h · Temperatur °C · Wind/Böen km/h`.

### Technische Details

- Schnee-Toggle: gleicher `Switch`-Aufbau wie Sonnenschein, Label „Schnee".
- Header-Layout: beide Switches in einer Flex-Reihe (gap-4), auf schmalen Containern untereinander.
- Y-Achsen-Spalte links wächst dynamisch: bestehender Aufbau (Niederschlag immer, Sonne nur bei `extended`) wird um einen optionalen Schnee-Abschnitt erweitert.
- Skala Schnee: 0 / 1 / 2 cm (passend für stündliche Werte in der Schweiz; Werte > 2cm/3h werden visuell gekappt, Zahlenlabel zeigt aber den echten Wert).
- Keine Änderungen an `fetchForecast`, `routeTree.gen.ts` oder Admin/Embed.

### Nicht im Plan enthalten

- Persistenz des Schnee-Toggles (kann später ergänzt werden, falls gewünscht).
- Änderungen am DayStrip (5-Tage-Übersicht bleibt wie sie ist).
