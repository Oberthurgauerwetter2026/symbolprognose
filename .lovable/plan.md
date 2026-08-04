# Visuelles Tick-Feedback im Filmstrip

## Ziel
Auf iPhones ersetzt ein dezentes visuelles Pulsieren die nicht mehr unterstützte Web-Haptik. Android-Geräte behalten die echte Vibration.

## Umsetzung
- Bei jedem tatsächlich gewechselten Filmstrip-Zeitschritt einen kurzen visuellen Impuls auslösen.
- Die feste Mittellinie und der obere farbige Marker pulsieren gemeinsam, ohne Layoutverschiebung.
- Tageswechsel etwas deutlicher darstellen als normale Mess- oder Prognoseschritte.
- Das Feedback nur während direkter Bedienung auslösen; automatisches Abspielen bleibt ruhig.
- `prefers-reduced-motion` respektieren und dann auf Animation verzichten.

## Technische Details
- Tick-Zustand direkt in der vorhandenen Filmstrip-Komponente verwalten und bei Indexwechsel neu starten.
- Vorhandene Haptik weiterhin als Best-Effort für unterstützte Geräte verwenden.
- Keine Änderungen an Radar-Daten, Zeitraster oder Kartenlogik.

## Prüfung
- TypeScript-Prüfung ausführen.
- Filmstrip per Touch-/Pointer-Scrubbing prüfen: ein Impuls pro neuem Frame, keine Doppelimpulse und kein Springen der Anzeige.
