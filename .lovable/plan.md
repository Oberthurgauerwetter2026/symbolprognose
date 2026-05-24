# Lokalprognose – Anpassungen

Drei kleine, isolierte Änderungen im `WeatherWidget` (Route `/karten/lokal`).

## 1. Prognose-Hintergründe in Blau statt Weiss

In `src/components/weather-widget.tsx`:

- **DayStrip (Übersicht, 7-Tage-Pillen)** – heutige Tageskarten haben `bg-zinc-50` (weiss). Umstellen auf `bg-[var(--accent-soft)]` (helles Blau, gleiche Familie wie die aktive Pille).
- **Detail-Panel (Stundenprognose)** – Section-Container `bg-zinc-50` → `bg-[var(--accent-soft)]`. Innere Header-/Footer-Leisten (`bg-zinc-100/70` bzw. `bg-zinc-100/50`) ebenfalls auf eine etwas kräftigere blaue Variante (`color-mix` aus accent), damit die Schichtung erhalten bleibt.
- **Kontrast für aktiven Tag wahren** – aktive Tageskarte im DayStrip wechselt von `bg-[var(--accent-soft)]` auf solides `bg-accent` mit `text-accent-foreground` (weisse Schrift), damit sie sich vom nun blauen Default-Hintergrund klar abhebt. Die obere Accent-Linie bleibt.
- **Aktueller Slot im Detail-Panel** – analog von `bg-[var(--accent-soft)]` auf `bg-accent/15` plus stärkerem Akzent oben, damit er sich vom blauen Grundton abhebt.

Wochentags-Pills bleiben in ihrer aktuellen Form/Layout, nur die Farben werden angepasst.

## 2. Ortung zeigt Ortsnamen, nie Koordinaten

In `src/lib/weather.ts` → `reverseGeocode`:

- Aktuell: Open-Meteo Reverse-Geocoding; bei Fehlschlag Fallback auf Koordinaten-String.
- Neu: Bei Fehlschlag zusätzlich Nominatim (`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12`) anfragen und `address.city / town / village / municipality / suburb` verwenden.
- Falls auch das scheitert: Fallback-String `"Aktueller Standort"` statt Koordinaten zurückgeben.

Damit zeigt der Header nach Klick auf „Ortung" immer einen Namen.

## 3. Kein Standard-Ort mehr (Amriswil entfernen)

In `src/components/weather-widget.tsx`:

- `DEFAULT_LOCATION` (Amriswil) entfernen. `location` State wird `StoredLocation | null`:
  - Init: `initialLocation` → sonst `localStorage` → sonst `null`.
- Bedingung `isDefaultLocation` entfällt – Ortsname **immer** im Header anzeigen, sobald ein Ort gesetzt ist.
- Wenn `location === null`:
  - Forecast-Query disabled (`enabled: !!location`).
  - Statt DayStrip/DetailPanel/Footer eine ruhige Such-Aufforderung rendern: Hinweistext „Gemeinde suchen oder Ortung verwenden, um die 5-Tage-Prognose anzuzeigen." mit Pfeil/Icon nach oben zur Suchleiste. Header (Suche + Ortung-Button + Toggles) bleibt sichtbar.
- Sobald ein Ort gewählt/geortet wurde, wird er via `localStorage` für künftige Besuche gespeichert (bestehendes Verhalten).

## Nicht angefasst

- Routen, Embed-Varianten, Wetter-Karte (Region), Slider, Icons, Pollen/Radar/Wind-Karten.
- Logik der Stundenslots, Cadence-Wechsel, Sonnenschein-/Schnee-Toggles.
