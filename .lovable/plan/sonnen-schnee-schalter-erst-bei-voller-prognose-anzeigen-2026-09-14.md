# Sonnen-/Schnee-Schalter erst bei voller Prognose anzeigen

## Ziel

In der Lokalprognose erscheinen die Schalter für Sonne und Schnee (on/off) nur, wenn die vollständige Prognose geöffnet ist. In der kompakten Startübersicht bleiben sie verborgen.

## Umsetzung

1. **Zustand an den Header übergeben**
   - `WeatherWidgetInner` übergibt den aktuellen Wert von `showFullForecast` an die `Header`-Komponente.

2. **Schalter bedingt rendern**
   - In `Header` werden die beiden Schalter mit Sonne- und Schneeflocke-Icon nur angezeigt, wenn `showFullForecast === true`.
   - Ist die kompakte Übersicht aktiv, erscheint stattdessen nur Ortssuche/Ortung, Ortsname und Favoriten-Button.

3. **Keine Änderung an der Funktionalität**
   - Der interne State `extended`/`snow` und deren Toggle-Handler bleiben unverändert.
   - Sobald der Benutzer „Ganze Prognose anzeigen“ klickt, eine Tageskachel tippt oder einen Ort wählt, schaltet `showFullForecast` auf `true` und die beiden Schalter werden sichtbar.

## Technische Hinweise

- Änderung ausschliesslich in `src/components/weather-widget.tsx`.
- Keine neuen Dateien, Routen oder Datenabfragen erforderlich.

## Prüfung

- Kompakte Startansicht: Sonnen- und Schneeschalter sind nicht sichtbar.
- „Ganze Prognose anzeigen“ oder Tageskachel klicken: Schalter erscheinen.
- „Kompakte Übersicht“ klicken: Schalter verschwinden wieder.
- Seite `/karten/lokal` und Embed `/embed/lokalprognose` sowie feste Detail-Embeds verhalten sich wie vorgesehen.
