# Karte: Kanton Thurgau + Default „Heute"

## 1. Kanton Thurgau als helleres Grau

- Neue Datei `src/data/thurgau.json` mit `FeatureCollection` der Kantonsgrenze (Quelle: swisstopo `ch.swisstopo.swissboundaries3d-kanton-flaeche.fill`, vereinfacht über `api3.geo.admin.ch`).
- In `region-map.tsx` zwischen `OUTSIDE_MASK` und `LAKE` ein neuer `<GeoJSON data={THURGAU} />`-Layer:
  - `fillColor: #9aa5ae`, `fillOpacity: 0.55` (deutlich heller als die Aussen-Maske `#5a6670 / 0.6`)
  - kein Stroke, `interactive={false}`
- Reihenfolge bleibt: Aussen-Maske (dunkelgrau) → Thurgau (hellgrau) → See → Region (grün) → Marker.
- Effekt: das Umfeld ausserhalb CH/TG bleibt dunkel, der Kanton hebt sich heller ab, die Region Oberthurgau bleibt grün hervorgehoben.

## 2. Default-Ansicht „heutiger Tag"

In `RegionMap()`:
- `useState<"hourly" | "daily">("hourly")` → `useState<"hourly" | "daily">("daily")`
- `useState(0)` für `selectedDayIdx` bleibt (= heute)

Verhalten:
- Beim Öffnen der `/karte`-Seite ist „Heute" aktiv markiert, Marker zeigen die Tageswerte (Symbol & Min/Max).
- Klick auf das „Stündlich"-Pill schaltet wie bisher in den Stundenmodus, Slider startet bei der aktuellen Stunde.
- Klick auf einen anderen Wochentag wechselt wie gewohnt in die Tagesansicht dieses Tages.

## Out of Scope

- Pill-Design, Slider-Layout, Datenabruf, Marker-Inhalt bleiben unverändert.
- Keine neuen Abhängigkeiten.
