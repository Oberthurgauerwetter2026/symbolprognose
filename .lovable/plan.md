## Ziel
swisstopo als Grundbasis behalten, aber die Karte „ruhiger" machen (keine störenden Ortsnamen), graue Aussenmaske + grünliche Region wie zuvor, und der 3‑h‑Schieberegler soll die Wettersymbole tatsächlich verändern.

## Änderungen in `src/components/region-map.tsx`

### 1. Hintergrundkarte ohne Ortsnamen
swisstopo bietet keine vollständig labelfreie Pixelkarte. Wir wechseln deshalb auf die **swisstopo „Leichte Basiskarte" (grau)** — sie ist bewusst zurückhaltend und enthält deutlich weniger Beschriftungen:

```tsx
<TileLayer
  url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte/default/current/3857/{z}/{x}/{y}.png"
  maxZoom={18}
  attribution='© swisstopo, © OpenStreetMap contributors'
/>
```

Falls die wenigen verbleibenden Labels innerhalb der Region noch stören, verstärken wir den grünlichen Region‑Overlay etwas, so dass sie optisch zurücktreten:

- Region: `fillColor: "#9fcf85"`, `fillOpacity: 0.45` (vorher 0.28). Hover bleibt deutlich heller.
- Aussenmaske (`#8a96a0`, `opacity 0.7`) bleibt unverändert — Aussenbereich wirkt weiterhin grau.
- Bodensee‑Polygon (`#7ec8e3`) bleibt unverändert, damit der See klar als See erkennbar bleibt.

### 2. Schieberegler verändert die Symbolik
Aktuell zeichnet `SpotMarker` nur `data.daily.weathercode[dayIndex]` — der Slider hat keinen Effekt. Wir hängen den Code an die gewählte Stunde:

- `SpotMarker` bekommt zusätzlich `hourStep: number`.
- Stunde = `dayIndex * 24 + hourStep * 3` als Index in `data.hourly.weathercode`.
- Symbol = `data.hourly.weathercode[hourIndex]` (verändert sich mit dem Slider).
- Temperaturen bleiben wie gefordert **Tages‑Min/Max** (`daily.temperature_2m_min/max[dayIndex]`), sie reagieren also nur auf den Tageswechsel — das war die ausdrückliche Vorgabe.
- `useMemo`‑Deps: `[data, dayIndex, hourStep, spot]`.

`RegionMap` reicht `hourStep` an jeden `SpotMarker` durch.

### 3. Sicherstellen, dass `weather.ts` `hourly.weathercode` liefert
Kurzcheck in `src/lib/weather.ts`: Open‑Meteo‑Aufruf muss `hourly=weathercode` enthalten. Falls nicht, ergänzen wir den Parameter und den Typ — ohne sonstige Logikänderungen.

## Nicht geändert
- Bodensee‑Polygon, Marker‑Layout, Bounds/Zoom, Tagesleiste, Slider‑Range/Defaults (Heute = aktuelle Zeit, andere Tage ab 00:00), Region‑Klick → `/`, Bodensee‑Label.

## Offene Punkte
- Wenn die „Leichte Basiskarte" optisch zu schlicht wirkt (kaum Topografie), können wir alternativ die **Pixelkarte farbig** behalten und die grüne Region‑Fläche stärker deckend (z.B. `fillOpacity: 0.6`) machen, so dass Ortsnamen darunter verschwinden. Sag Bescheid, welche Variante du bevorzugst.
