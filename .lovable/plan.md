## Ziel

Die Wetter-Icons im Panel sollen wieder im bestehenden Stil (puffige Wolken, Mondsichel mit Maske, Tropfen-Form, dicker Blitz) aus `src/components/weather-icons/index.tsx` erscheinen — aber 1:1 vom MCH-Wettercode gesteuert (kein WMO-Umweg, keine Heuristik).

Aktuell rendert `WeatherIcon` bei vorhandenem `mchCode` das `MchPictogram`, das ein eigenes (flacheres) Symbolset benutzt. Das wird ersetzt durch ein direktes Mapping MCH-Code → vorhandene `Icon*`-Komponente.

## Änderungen

### 1. Neuer Dispatcher `mchToIcon(code)` in `src/components/weather-icons/index.tsx`

Mapping (Tag-Codes 1–35; Nacht = Code−100 mit `isDay=false`):

| MCH | Bedeutung | Icon |
|---|---|---|
| 1 | sonnig / klar | `IconClear` / `IconClearNight` |
| 2 | leicht bewölkt | `IconMostlyClear` |
| 3 | bewölkt | `IconPartlyCloudy` |
| 4 | stark bewölkt | `IconPartlyCloudy` |
| 5 | bedeckt | `IconCloudy` |
| 6 | leichter Regen | `IconDrizzle` |
| 7 | Regen | `IconRain` |
| 8 | starker Regen | `IconRain` |
| 9 | Regenschauer | `IconSunShower` (Tag) / `IconRain` (Nacht) |
| 10 | Schnee | `IconSnow` |
| 11 | Schneeschauer | `IconSnow` |
| 12 | Gewitter | `IconThunderstorm` |
| 13 | starkes Gewitter | `IconThunderstorm` |
| 14 | leichter Schneefall | `IconSnow` |
| 15 | Schneefall | `IconSnow` |
| 16 | starker Schneefall | `IconSnow` |
| 17 | Regen+Schnee | `IconSnow` |
| 18 | starker Regen+Schnee | `IconSnow` |
| 19 | Schneeregenschauer | `IconSnow` |
| 20 | starker Schneeschauer | `IconSnow` |
| 21 | leichter Schneeregen | `IconSnow` |
| 22 | Schneeschauer dicht | `IconSnow` |
| 23 | Schneeregenschauer dicht | `IconSnow` |
| 24 | Gewitter+Regen | `IconThunderstorm` |
| 25 | starkes Gewitter | `IconThunderstorm` |
| 26 | leicht bewölkt variabel | `IconMostlyClear` |
| 27 | wechselnd bewölkt | `IconPartlyCloudy` |
| 28 | stark bewölkt variabel | `IconCloudy` |
| 29 | bedeckt mit Regen | `IconDrizzle` |
| 30 | Nebel | `IconFog` |
| 31 | Sturm | `IconThunderstorm` |
| 32 | Wind | `IconCloudy` |
| 33 | Hochnebel | `IconFog` |
| 34 | Bise/Sand | `IconFog` |
| 35 | Schneesturm | `IconSnowThunder` |

Tag/Nacht: für die Codes mit Sonne/Mond-Variante (1, 2, 3, 9, 26, 27) wird `isDay` aus `code < 100` abgeleitet; bei reinen Wolken-/Regen-/Schnee-Codes spielt es keine Rolle (Icons enthalten keine Sonne).

### 2. `WeatherIcon`-Dispatcher anpassen

Der MCH-Vorrang-Block ersetzt `MchPictogram` durch den neuen `mchToIcon`-Dispatcher. Übrige Logik bleibt unverändert.

```ts
if (hasMch) {
  return mchToIcon(mchCode, size, className);
}
```

### 3. Icon-Katalog `src/routes/intern.icons.tsx`

Die beiden Sektionen „MCH-Pictogramme · Tag/Nacht" rendern statt `MchPictogram` ebenfalls über `WeatherIcon` mit `mchCode`, damit der Katalog dieselbe Darstellung zeigt wie das Panel.

### 4. Server-SVG `src/lib/weather-icon-svg.server.ts`

Falls dort aktuell `renderMchSvg(code)` benutzt wird (für noscript/Snapshot), wird die Auswahl analog auf die bestehenden SVG-Builder umgestellt, damit serverseitiges und clientseitiges Rendering identisch aussehen. Datei wird vor der Änderung gelesen, um die genaue Einbindung zu prüfen.

### 5. Cleanup

- `mch-spec.ts` bleibt nur noch wegen `mchLabel(code)` (aria-Labels) bestehen; die `render*`-Funktionen werden nicht mehr aufgerufen. Sie bleiben vorerst im Code, ohne Re-Export aus `index.tsx`.
- `MchPictogram` wird nicht mehr aus `WeatherIcon` referenziert. Datei bleibt unverändert (kein Risiko durch Löschen).

## Out of Scope

- Keine Änderung an Ingest, Cache, Dispatch-Logik oder Datenpipeline.
- Keine Änderung am bisherigen Look der `Icon*`-Komponenten.
