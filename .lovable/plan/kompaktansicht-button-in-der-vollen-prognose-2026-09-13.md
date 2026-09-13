# Kompaktansicht-Button in der vollen Prognose

## Ziel

In der Lokalprognose (Seite `/karten/lokal` und WP-Embed `/embed/lokalprognose`) kann die geöffnete vollständige Prognose wieder auf die kompakte Übersicht reduziert werden.

## Umsetzung

1. **Button „Kompakte Übersicht" einfügen**
   - Am Ende der vollständigen Prognose (unter dem Aktualisierungs-Zeitstempel) erscheint ein Button „Kompakte Übersicht" mit Chevron-nach-oben.
   - Ein Klick setzt `showFullForecast` zurück auf `false` und zeigt wieder Tageskacheln, Kurz-Stundenübersicht und den Button „Ganze Prognose anzeigen".

2. **Nur dort, wo es eine Kompaktansicht gibt**
   - Der Button erscheint nur, wenn die Kompaktansicht grundsätzlich aktiv ist (Prop `compactAutoLocation`) und kein fester/URL-Ort (`initialLocation`, `lockedLocation`) die volle Ansicht erzwingt.
   - Feste Detail-Embeds und die Such-Embeds bleiben unverändert.

3. **Embed-Höhe**
   - Die bestehende automatische Höhenanpassung des Embed-Rahmens übernimmt das Zusammenklappen ohne weitere Änderung.

## Technische Hinweise

- Änderung nur in `src/components/weather-widget.tsx`: bedingter Button im Voll-Prognose-Zweig (nach `DataStamp`), `setShowFullForecast(false)`, vorhandene `Button`-Komponente und `ChevronUp`-Icon.
- Keine Änderung an Datenabruf, Routen oder anderen Embeds.

## Prüfung

- Seite und Embed: kompakt → aufklappen → wieder reduzieren; Tageswahl öffnet weiterhin direkt die volle Prognose.
- Mobile Ansicht und automatische Embed-Höhe prüfen.
