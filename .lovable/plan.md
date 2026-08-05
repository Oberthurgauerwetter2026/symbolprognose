# Automatische Gewitterwarnung: früher und zuverlässiger auslösen

## Ausgangslage (geprüft)

- Heute Abend hat die Automatik korrekt ausgelöst: drei Auto-Warnungen Stufe 3 für Horn, Arbon und Roggwil (gültig 19:06–19:56 Lokalzeit), danach automatisch beendet.
- Aktuell melden alle 21 Gemeinden 0.0 mm/h — deshalb liegt jetzt keine Warnung vor.
- Zwei erkennbare Lücken:
  1. **Latenz:** Der ausgewertete Radar-Frame ist beim Abruf 12–17 Minuten alt. Eine Zelle erzeugt also erst deutlich nach dem Durchzug eine Warnung.
  2. **Nur Gemeindefläche:** Es zählt ausschliesslich das Maximum *innerhalb* einer Gemeinde. Eine kräftige Zelle, die 3–5 km ausserhalb steht und auf die Region zuzieht, löst nichts aus — obwohl sie in wenigen Minuten eintrifft.

## Was gebaut wird

1. **Umland-Puffer (Zellen im Anmarsch)**
   Der Radar-Ingest schreibt zusätzlich zum Gemeindemaximum ein Maximum in einem Puffer um jede Gemeinde (ca. 6 km). Zieht eine Zelle über der Schwelle im Puffer und bewegt sie sich auf die Gemeinde zu, wird eine Warnung mit Hinweis „Zelle zieht heran“ erstellt — mit derselben Stufenlogik, aber Gültigkeit ab jetzt.

2. **Aktualität sichtbar machen**
   Im Admin-Tool wird pro Gemeinde der aktuell gemessene Spitzenwert (mm/h), der Messzeitpunkt und das Alter angezeigt, dazu die aktive Schwelle. So ist auf einen Blick nachvollziehbar, warum eine Zone gewarnt hat oder nicht.

3. **Latenz reduzieren**
   Der Radar-Ingest wird so angepasst, dass er den jeweils neuesten verfügbaren Messframe verwendet und `region-max.json` direkt nach dem Frame-Download schreibt (statt am Ende des Gesamtlaufs). Zielsetzung: Warnung innerhalb von rund 5–8 Minuten nach dem Messzeitpunkt.

4. **Keine Schwellenänderung**
   Die Stufen bleiben bei 15 / 30 / 50 mm/h (MeteoSchweiz-konform). Für „knapp darunter“-Situationen ist die Vorinformation im Admin-Tool das richtige Mittel, nicht eine tiefere Automatikschwelle.

## Technische Details

- `scripts/ingest_radar.py`: `write_region_max()` erweitert um `bufMmh` je Gemeinde (Puffer-Maximum) und Aufruf früher im Ablauf.
- `src/lib/openmeteo-cache.server.ts`: Typ `RadarRegionMaxPayload` um `bufMmh` ergänzt.
- `src/lib/auto-thunder.server.ts`: Auslösung entweder über Gemeindemaximum oder über Puffermaximum in Kombination mit Verlagerung Richtung Gemeinde; Beschreibungstext unterscheidet „gemessen über der Gemeinde“ und „Zelle zieht heran“.
- `src/routes/admin-warnungen.tsx`: neuer Abschnitt „Radarmessung je Gemeinde“ (Werte, Messzeit, Alter, Schwelle) im bestehenden Datenquellen-Bereich.
