# Lokalprognose-Quellenangabe korrigieren

## Problem

Die Lokalprognose zeigt aktuell unter dem Widget eine ungenaue Quellenangabe:

`Datenstand: <Datum/Zeit> · Quelle: Oberthurgauer Wetter · Modelle: ICON-seamless, DWD-MOSMIX`

Für die Lokalprognose wird aber kein ICON-seamless verwendet, sondern **MeteoSchweiz local_forecast (OGD)** mit **DWD-MOSMIX**-Erweiterung (siehe auch der Untertitel der Route `/karten/lokal`).

## Ziel

Die Quellenangabe auf der Lokalprognose-Seite und in allen ihren Embed-/Noscript-Fallbacks einheitlich auf die tatsächlichen Datenquellen reduzieren:

`Aktualisiert <Datum/Zeit> · Quelle: Oberthurgauer Wetter · MeteoSchweiz local_forecast (OGD) · DWD-MOSMIX`

## Betroffene Stellen

- `src/components/weather-widget.tsx`
  - `DataStamp`: Text und Tooltip anpassen (ICON-seamless entfernen, local_forecast ergänzen, "Aktualisiert" statt "Datenstand").
- `src/components/embeds/lokal-noscript.tsx`
  - Fußzeile: Quellenformel auf die gleiche Formulierung bringen, `via opendata.dwd.de` entfernen.
- `src/routes/api/public/embed/region-lokal-static.ts`
  - Statisches Embed: neben dem Stand eine Quellenzeile ergänzen, damit der noscript-/Widget-Fall konsistent ist.
