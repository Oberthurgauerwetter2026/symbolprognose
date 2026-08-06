# Quellenangabe der Lokalprognose kürzen

## Problem

Die Fußzeile der Lokalprognose listet aktuell alle Datenquellen der ganzen App:

`MeteoSchweiz local_forecast (OGD, ICON-CH1/CH2-EPS) · DWD-MOSMIX (Tag 6–10) · Open-Meteo ICON-seamless (Karten & Niederschlag) · MeteoSchweiz CPC (Radar) · EUMETSAT MTG (Satellit) · aktualisiert 22:43`

Radar, Satellit und die Kartenmodelle haben mit der Lokalprognose nichts zu tun.

## Neue Zeile

`Quelle: Oberthurgauer Wetter · MeteoSchweiz local_forecast (OGD) · DWD-MOSMIX · aktualisiert HH:MM`

Damit identisch zu den bereits korrigierten Embed-/Noscript-Fallbacks.

## Technische Umsetzung

- `src/components/weather-widget.tsx`, Funktion `Footer` (Zeilen 1480–1486): Quellentext auf die drei relevanten Angaben reduzieren, Zeitstempel unverändert lassen. Rechte Spalte mit „Grafik © oberthurgauerwetter.ch“ bleibt.
