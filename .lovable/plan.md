## Was gebaut wird

Ein eigenständiges, in WordPress per `<iframe>` einbettbares 5-Tage-Wetter-Widget im gewählten "Instrumental Swiss"-Design. Datenquelle: Open-Meteo (Modell ICON-CH2 von MeteoSchweiz). Ortssuche für die Schweiz mit Geolocation-Button auf dem Smartphone.

## Funktionsumfang

**Header**
- Ortsname + Suchfeld mit Autocomplete (CH-Gemeinden via Open-Meteo Geocoding, `countryCode=CH`)
- "Ortung"-Button → `navigator.geolocation` + Reverse-Geocoding
- Toggle "Erweiterte Anzeige" (Ein/Aus) für Sonnenscheindauer + Sonnenaufgang/-untergang

**5-Tage-Streifen**
- 5 Tageskarten, horizontal scrollbar auf Mobile (Scroll-Snap), Grid auf Desktop
- Pro Karte: Wochentag + Datum, Wettersymbol (WMO-Code → Icon), Tmax/Tmin, Niederschlag in mm + Wahrscheinlichkeit %, Wind Mittel/Böen + Richtungspfeil
- Wenn Toggle "Ein": zusätzlich Sonnenstunden, Sonnenaufgang/-untergang
- Aktiver Tag mit rotem Akzentbalken oben + Ring; Klick wechselt Auswahl
- "Heute" automatisch vorausgewählt

**Detail-Panel (3-Stunden-Takt)**
- Erscheint unterhalb beim ausgewählten Tag (animiert)
- Heute: startet beim aktuellen 3-Stunden-Slot, rückt automatisch nach (Re-Render alle 60 s)
- Folgetage: startet immer 00:00
- Pro Slot: Zeit, Wettersymbol, Temperatur, Niederschlag mm + %, Wind Mittel/Böen + Richtungspfeil, Neuschnee in cm
- Horizontal scrollbar, aktueller Slot rot hinterlegt

**Footer**
- Quelle "MeteoSchweiz ICON-CH2 (via Open-Meteo)", letzter Update-Zeitpunkt, Sonnenauf-/-untergang als Mini-Anzeige

**Persistenz**
- Letzter Ort in `localStorage`, Standard = Amriswil (47.5504, 9.3021)

**Einbindung in WordPress**
- Route `/` rendert das pure Widget (keine zusätzliche Chrome) → eignet sich direkt für `<iframe>`
- Route `/embed-info` zeigt das fertige iframe-Snippet zum Kopieren

## Technische Umsetzung

```text
src/
├── styles.css                       # Zinc-Palette + Akzentrot #e62117 als Tokens, Inter-Font
├── routes/
│   ├── __root.tsx                   # Meta: title "5-Tage Wetterprognose"
│   ├── index.tsx                    # Rendert <WeatherWidget />
│   └── embed-info.tsx               # Iframe-Snippet + Copy-Button
├── lib/
│   └── weather.ts                   # Open-Meteo Geocoding + Forecast Fetcher, WMO-Symbol-Mapping, Helpers
└── components/
    ├── weather-widget.tsx           # Hauptkomponente, Composition wie Prototype
    ├── location-search.tsx          # Combobox mit Autocomplete (debounce 300 ms)
    ├── day-card.tsx                 # Eine Tageskarte
    └── hourly-detail.tsx            # 3h-Streifen
```

### Datenquelle
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?countryCode=CH&language=de&count=8&name=…`
- Reverse-Geocoding: `https://geocoding-api.open-meteo.com/v1/reverse?latitude=…&longitude=…&language=de`
- Forecast: `https://api.open-meteo.com/v1/forecast?...&models=icon_seamless&timezone=auto&forecast_days=6`
  - `daily`: weathercode, temperature_2m_max/min, precipitation_sum, precipitation_probability_max, windspeed_10m_max, windgusts_10m_max, winddirection_10m_dominant, sunshine_duration, sunrise, sunset, snowfall_sum
  - `hourly`: weathercode, temperature_2m, precipitation, precipitation_probability, windspeed_10m, windgusts_10m, winddirection_10m, snowfall
- ICON-CH2 ist in `icon_seamless` integriert; alternativ `models=icon_ch2` falls verfügbar
- Alle Calls passieren im Browser (CORS aktiviert), kein Backend nötig

### State & Caching
- TanStack Query: `useQuery` für Forecast (staleTime 15 min), `useQuery` für Suche (debounce 300 ms)
- Aktuelle Uhrzeit via `setInterval(60_000)` für automatisches Nachrücken im 3h-Streifen

### Design-Tokens (verbatim aus Prototype)
- Zinc-Palette 50–900, Akzent `#e62117`, Inter-Font, kleine Radii (rounded-sm), klare Grids mit `divide-x/divide-y`, durchgehend `tracking-wider uppercase` für Labels

## Responsiveness
- < 768 px: 5 Tageskarten in horizontalem Scroll-Snap-Container
- ≥ 768 px: 5-Spalten-Grid
- Detail-Panel immer horizontal scrollbar (8 Spalten = 24 h)
- Header bricht auf Mobile vertikal um

## Was nicht enthalten ist
- Kein Backend, keine API-Keys, keine Datenbank
- Keine Custom-Wetter-Icons (WMO-Code-Emoji-Mapping reicht für v1; SVG-Set kann später nachgereicht werden)
- Keine Mehrsprachigkeit (nur DE)
