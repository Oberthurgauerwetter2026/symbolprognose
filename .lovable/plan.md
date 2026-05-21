## Probleme

1. **Bodensee wird nicht angezeigt.** `src/data/lake.json` enthält nicht den Bodensee, sondern ein Polygon in Griechenland (lat ~38.9, lon ~22.1). Deshalb erscheint der See‑Bereich nur als dunkelgraue Aussenmaske statt als blaue Wasserfläche.
2. **Schieberegler beginnt bei 00:00.** Für `dayIndex===0` sollte er erst ab dem aktuellen 3‑h‑Slot starten (frühere Slots gesperrt / nicht erreichbar).
3. **Marker zeigen zusätzlich Stunden‑Temperatur.** Gewünscht sind nur Min/Max.
4. **Reihenfolge unter der Karte falsch.** Aktuell: Tagesleiste oben, Karte, Schieberegler. Gewünscht: Karte, dann Tagesleiste, darunter Schieberegler.
5. **Region‑Klick → `/` funktioniert nicht.** `useNavigate()` ohne `from` plus Leaflet‑Event‑Bubbling: Click wird ggf. von der Aussenmaske (jetzt `interactive:false`, ok) oder von Marker‑DivIcons abgefangen. Sicherer Fix: harten Navigationspfad via `window.location.assign("/")` oder `router.navigate({ to: "/" })` mit `getRouter`.

## Änderungen

### 1. Bodensee‑Polygon ersetzen (`src/data/lake.json`)
- Datei komplett ersetzen durch ein FeatureCollection mit einem groben Bodensee‑Polygon (Obersee + Untersee), das den auf der Karte sichtbaren Bereich abdeckt. Koordinaten‑Box etwa: lat 47.50–47.78, lon 9.05–9.55.
- Quelle: vereinfachtes Polygon entlang der Uferlinie (Punktliste im Plan‑Implementierungsschritt, ~30 Stützpunkte, ausreichend für die Zoomstufe 11–13).

### 2. Aussenmaske: See ausschneiden (`region-map.tsx`)
- `OUTSIDE_MASK` so erweitern, dass nicht nur die REGION‑Features als Löcher gestanzt werden, sondern auch das Lake‑Polygon. So bleibt der See an den Stellen ausserhalb der Region nicht „grau überdeckt".
- Konkret: in der IIFE zusätzlich über `LAKE.features` iterieren und deren Ringe ebenfalls in `holes` aufnehmen.

### 3. Schieberegler ab aktueller Zeit (`region-map.tsx`)
- Neuer Helper `currentHourStep()` → `Math.ceil(new Date().getHours() / 3)` (0–7, geclamped).
- `minHourStep` per `useMemo` aus `dayIndex`: `dayIndex === 0 ? currentHourStep() : 0`.
- `Slider min={minHourStep}`; `useEffect`, der bei Wechsel auf `dayIndex===0` `hourStep` auf `max(hourStep, minHourStep)` hebt; bei Wechsel weg von Tag 0 nichts forcieren.
- Tick‑Skala unterhalb: nur Slots ab `minHourStep` voll, frühere Slots ausgegraut (`opacity-30`).

### 4. Marker: nur Min/Max
- `MarkerPill`: `tHour`‑Badge und `tHour`‑Prop entfernen.
- `SpotMarker`: Tages‑`weathercode` statt Stunden‑Code verwenden; `hourStep` als Prop entfällt (und damit auch das Re‑Rendern der Icons bei jedem Slider‑Tick — DivIcon bleibt stabil).
- `MarkerPill.iconSize` ggf. auf `[200, 64]` reduzieren.

### 5. Layout‑Reihenfolge unter der Karte
- Render‑Reihenfolge in `RegionMap` ändern:
  1. Karte (`<div className="relative h-[600px] …">`).
  2. Tages‑Umschalter (Pill‑Group, aktuell oberhalb der Karte) verschiebt sich nach unten.
  3. Darunter der Schieberegler‑Block.

### 6. Region‑Klick zuverlässig
- Statt `navigate({ to: "/" })` → `router.navigate({ to: "/" })` via `useRouter()` aus `@tanstack/react-router`. Fallback bleibt `window.location.assign("/")`, falls der Klick im SSR‑/Bootstrap‑Pfad noch nicht greift.
- Zusätzlich `interactive={false}` an allen Markern (Spots), damit sie Klicks nicht abfangen — Marker bleiben rein dekorativ. (Detail‑Sheet ist bereits entfernt.)
- `eventHandlers.click` auch an `LAKE`‑Polygon (interactive=false bleibt) NICHT. See bleibt nicht klickbar.

## Nicht geändert
- `src/lib/weather.ts`, `src/data/region.json`, Routen, Brand‑Farbe `#2561a1`, „Bodensee"‑Label, Zoom‑/Bounds‑Werte.

## Offene Punkte
- Soll der gesperrte Bereich des Sliders sichtbar bleiben (linker Bereich ausgegraut) oder soll der Track erst ab `minHourStep` beginnen? Default: sichtbar, ausgegraut.
- Bodensee‑Polygon wird vereinfacht — ausreichend für den aktuellen Zoom, aber kein exaktes Uferprofil.