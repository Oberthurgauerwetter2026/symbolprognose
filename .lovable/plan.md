# Sonnenauf-/untergang in Sonnenschein-Grafik integrieren

## 1. Aus Übersicht entfernen
`src/components/weather-widget.tsx`, Zeilen 431–436 (im 7-Tage-Kartendeck, `extended`-Block mit `↑ {sunrise}` / `↓ {sunset}`) ersatzlos löschen. Die Karten zeigen damit nur noch Temperatur, Niederschlag und Wind.

## 2. In den Sonnenschein-Chart integrieren
Im Detail-Panel hat der Sonnenschein-Balkenchart (Zeilen 805–867) pro Slot bereits `iso`, `startHour` und `nHrs` (1 oder 3 Stunden). Pro Slot ermitteln, ob Sonnenauf- oder -untergang dieses Tages in den Stundenbereich `[startHour, startHour + nHrs)` fällt:

- Tag aus `iso.slice(0,10)` ableiten, passenden Tagesindex in `d.sunrise` / `d.sunset` finden, Uhrzeit über bestehenden `formatTimeHHMM`-Helper bzw. neuen Helfer in Dezimalstunden umrechnen (z. B. `06:42` → `6.7`).
- Wenn die Dezimalstunde im Slot liegt, einen vertikalen Marker absolut über den Balken legen:
  - `left: ((hour - startHour) / nHrs) * 100 %`
  - dünne vertikale Linie (`w-px bg-amber-500/70`, ganze Höhe `h-[72px]`)
  - kleines Label am oberen Rand: `↑ 06:42` bzw. `↓ 20:18` in `text-[9px] font-semibold text-amber-700`, leicht versetzt damit es nicht beschnitten wird (`whitespace-nowrap`, `-translate-x-1/2`, ggf. `translate-y-[-2px]`)
  - `title` mit voller Uhrzeit für Hover.
- Marker-Container im bestehenden `relative h-[72px]`-Wrapper (Zeile 826) ergänzen, damit er sauber über Balken und Rasterlinien sitzt.
- Beide Marker (Auf- und Untergang) unabhängig prüfen — pro Slot können maximal beide vorkommen, in der Praxis aber selten beide gleichzeitig.

## 3. Legende
In der Footer-Legende (Zeile 920–929) den Sonnenschein-Eintrag erweitern:
`Sonnenscheindauer in min/h · ↑ Sonnenaufgang · ↓ Sonnenuntergang`

## Unverändert
Datenfluss, Modell, 1h-/3h-Logik, Wind, Niederschlag, Schnee. Sunrise/Sunset bleiben in `weather.ts` erhalten — nur die Darstellung wandert.

## Offene Annahme
Marker erscheinen nur im erweiterten Modus (`extended`), weil der Sonnenschein-Chart auch nur dort sichtbar ist. Sage Bescheid, falls die Zeiten zusätzlich an anderer Stelle (z. B. unter dem Tagesnamen im Tageswechsler) erscheinen sollen — sonst setze ich es genau so um.
