## Plan

1. **MCH-Manifest robuster laden**
   - Den Radar-Servercode so anpassen, dass `R2_PUBLIC_URL` nicht die einzige Quelle ist.
   - Falls diese Variable fehlt oder das Manifest nicht lädt, wird zuerst der bestehende Debug-/Cache-Pfad bzw. bekannte Radar-Manifest-Pfad genutzt, statt still auf reine Modell-/Open-Meteo-Daten zurückzufallen.

2. **Nur echte MCH-Messframes als Messung zählen**
   - `hasRealRadar` soll nur `true` sein, wenn tatsächlich Frames mit `precipUrl` vorhanden sind.
   - In der Antwort eine klare Warnung setzen, wenn keine echten MCH-PNGs geladen wurden, damit der UI-Zustand nachvollziehbar ist.

3. **Messungen im Frontend sichtbar priorisieren**
   - Für vergangene Frames mit `precipUrl` weiterhin `MeasurementCanvasOverlay` rendern.
   - Wenn keine MCH-PNGs verfügbar sind, keine scheinbaren „Radar“-Frames aus Modellwerten als Ersatz vortäuschen; stattdessen bleibt die Prognose-/Fallback-Darstellung klar getrennt.

4. **Validieren**
   - Serverfunktion/Debug-Endpunkt prüfen: Anzahl Radarframes, Anzahl `precipUrl`, letzter MCH-Zeitstempel.
   - Auf `/karten/radar` prüfen, dass vergangene Frames echte MCH-Radarmessungen zeigen und der Übergang zur Prognose ohne Leerstelle bleibt.

## Technische Details

- Hauptdateien: `src/lib/radar.functions.ts`, ggf. `src/components/maps/radar-map.tsx`.
- Der aktuelle Code fällt bei fehlendem `process.env.R2_PUBLIC_URL` direkt auf Modell-/Cache-Daten zurück; genau dort sollen MCH-Manifest-Fallbacks und bessere Statussignale ergänzt werden.
- Keine Datenbank- oder Auth-Änderungen.