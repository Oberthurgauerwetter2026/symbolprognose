# Radar-Prognose: Weichere Framewechsel bei Stundenwechsel

## Ziel

Die Stundenwechsel in der Radar-Prognose sollen sich visuell runder und weniger abrupt anfühlen. Der Übergang zwischen zwei Prognosefeldern soll früher beginnen, länger dauern und mit einer noch sanfteren Kurve verlaufen. Die Messung (5-Minuten-Takt) bleibt weiterhin hart geschnitten.

## Verhalten

- **Auto-Play**: Prognose-Stundenschritte blenden früher und gleichmäßiger ins nächste Feld über.
- **Scrubben**: Beim Ziehen/Loslassen im Filmstrip gilt dieselbe sanfte Übergangslogik — das Bild wechselt nicht hart, sondern folgt der gewählten Zeitposition.
- **Messung**: Bleibt unverändert bei harten Frame-Wechseln (keine künstliche Bewegung).
- **Kurvenverlauf**: Statt einer S-Kurve mit schneller Mitte wird eine höherwertige Ease-in-out-Kurve verwendet, die Anfang und Ende noch flacher hält.
- **Schrittweite**: Der Fade beginnt früher im Stundenschritt (höherer Blend-Anteil), dadurch wirkt der Übergang weniger "zackig".

## Technische Umsetzung

- `src/components/maps/radar-map.tsx`
  - `fadeWeight`: Blend-Fenster vergrössern (z. B. von 0.4 auf 0.55) und Kurve durch eine höherwertige Smoothstep-/Ease-in-out-Variante ersetzen.
  - `PrecipOverlay` und `CrossfadePrecipOverlay`/`MeasurementCanvasOverlay`: `QSTEPS` leicht erhöhen (z. B. von 12 auf 24), damit die zwischengespeicherten Blend-Stufen feiner aufgelöst sind und keine sichtbaren Stufen beim Faden entstehen.
  - Keine Änderung an der Timeline-Generierung (`timelineSteps`) oder der Stunden-Kadenz; nur die lokale Übergangsfunktion wird angepasst.
- Keine Backend-/Ingest-Änderungen nötig.

## Validierung

- Kurzer visueller Check im Preview: Play-Animation und manuelles Scrubben über Prognosestunden hinweg.
- Keine Performance-Probleme durch erhöhte Cache-Auflösung beobachten (Cache-Max bleibt erhalten).
