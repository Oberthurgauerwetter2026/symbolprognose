# Radar-Autowarnung: Schwellenwerte angleichen

## Ausgangslage
- Der Auto-Thunder-Job (`src/lib/auto-thunder.server.ts`) benutzt `THUNDER_RAIN_MMH = [15, 30, 50]` mm/h für Stufe 1/2/3.
- Die Admin-Anzeige im Tool zeigt eine abweichende Skala (im Gespräch erwähnt: „ab 8 / 15 / 30 mm/h“), die im Code nicht wiederzufinden ist.
- Ziel ist es, beide Stellen auf den fachlich nötigen Wert zu bringen.

## Plan

1. **Recherche**
   - MeteoSchweiz-Warnkriterien für Gewitterregen / Starkregen ermitteln.
   - Vergleich mit der aktuellen Setzung (15/30/50) und der Admin-Anzeige (8/15/30).

2. **Vorschlag dokumentieren**
   - Empfohlene Radar-Schwellen für Stufe 1/2/3 inkl. Begründung.
   - Darstellung, ob auch die 1-Stunden-Regen-Zeile in `THRESHOLDS` davon betroffen ist.

3. **Code-Anpassung nach Freigabe**
   - `THUNDER_RAIN_MMH` in `src/lib/warnings-config.ts` auf die gewünschten Werte setzen.
   - Falls nötig, `THRESHOLDS.gewitter` (Regen pro Stunde) und `THRESHOLDS.regen` (1-Stunden-Zeile) synchronisieren.
   - Admin-Anzeige (`src/routes/admin-warnungen.tsx`) anpassen, damit die angezeigte Skala exakt mit dem Auto-Warn-Code übereinstimmt.

4. **Validierung**
   - Typecheck / Build prüfen.
   - Kurze Log-Prüfung des nächsten Auto-Thunder-Laufs, um sicherzustellen, dass Stufe 1 bei der neuen Schwelle auslöst.

## Offene Frage
- Soll ich die Recherche zuerst schriftlich als Vorschlag darstellen, oder hast du bereits eine konkrete Schwelle im Sinn (z.B. 8 / 15 / 30 mm/h oder 15 / 30 / 50 mm/h)?
