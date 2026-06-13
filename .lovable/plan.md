
# Windkarte exakt wie Radarkarte

Ziel: `wind-map.tsx` zeigt denselben Kartenhintergrund, dieselben Ortschaften mit denselben Zoom-Tiers wie `radar-map.tsx`. Nur der Daten-Layer (Farbe + Partikel + Pfeile) bleibt windspezifisch.

## Änderungen in `src/components/maps/wind-map.tsx`

1. **Ortschaften-Liste angleichen**: `WIND_CITIES` (aktuell nur 6 Hauptorte) durch die vollständige Radar-Liste ersetzen — Tier A (7 Hauptorte ab Zoom 10.5), Tier B (6 mittelgrosse Gemeinden ab Zoom 11.5), Tier C (6 kleine Gemeinden/Ortsteile ab Zoom 12.5). Identische Namen, Koordinaten und `minZoom`-Werte wie `RADAR_CITIES`.
2. **`cityIcon`-Funktion identisch** zu Radar: gleicher Font-Stack (`system-ui,-apple-system,Segoe UI,Roboto,sans-serif`), gleicher Klassenname-Stil. CSS-Klasse bleibt `wind-city-marker`, damit es keine Konflikte gibt.
3. **„Ortsumrisse" entfernen**: Den `THURGAU`-GeoJSON-Layer (Gemeindegrenzen Thurgau) aus dem Wind-Rendering streichen. Radar zeigt nur die schwache Kantonsgrenze — Wind soll das auch nur tun. *(Falls «Ortsumrisse» hier den `REGION_OUTLINE`-Layer meint, bitte kurz Bescheid — aktuell interpretiere ich es als die Thurgauer Gemeindelinien, die durch den 0.55-opaken Farb-Layer stärker hervortreten als beim Radar.)*
4. **Layer-Reihenfolge wie Radar**: Reihenfolge bleibt `OUTSIDE_CH_MASK` → `OUTSIDE_MASK` → `LAKE` → `SWITZERLAND` → `REGION_OUTLINE` → Daten-Layer → City-Marker → `ZoomControl`. (Aktuell identisch, wird nach Entfernen von `THURGAU` automatisch sauber.)

## Was sich NICHT ändert

- Wind-Datenlayer (`WindColorOverlay`, `WindParticleLayer`, `WindArrowLayer`, `WindHoverTooltip`) bleiben unverändert.
- Timeline / Settings-Popover / Tooltip-Logik bleiben unverändert.
- Radarkarte wird nicht angefasst.
- Keine Änderungen an Ingest, Server-Function oder Routen.

## Offene Frage

«Ortsumrisse» kann zweideutig sein. Ich gehe von **Thurgauer Gemeindelinien** (`THURGAU`-GeoJSON) aus, weil Radar diese auch nur sehr schwach (`opacity 0.45`) zeichnet und sie durch den dichteren Wind-Farb-Layer dominanter wirken. Falls etwas anderes gemeint ist (z. B. die weisse Schweizer Landesgrenze oder die blaue Region-Outline), bitte korrigieren — dann passe ich genau diesen Layer an.
