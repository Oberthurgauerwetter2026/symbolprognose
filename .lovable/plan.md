Optionales Feld „stärkste Phase“ für Wetterwarnungen

Ziel
Ein optionales Freitext-Feld ergänzen, mit dem die Redaktion für jede Warnung angeben kann, wann die stärkste Phase erwartet wird (z. B. „heute Nachmittag zwischen 14 und 17 Uhr“). Das Feld wird im Admin-Tool erfasst und im Info-Panel der Warnkarte angezeigt.

Geplante Änderungen

1. Datenbank
   - Neue Spalte `peak_phase` vom Typ `text` (optional, NULL erlaubt) in `public.warnings` hinzufügen.

2. Server-Seite
   - `WarningRow` in `src/lib/warnings.server.ts` um `peak_phase` erweitern.
   - `WarningDTO` in `src/lib/warnings.functions.ts` um `peakPhase: string | null` erweitern.
   - DTO-Mapping in `src/lib/warnings-dto.server.ts` um `peak_phase` → `peakPhase` ergänzen.
   - `saveWarning` in `src/lib/warnings.functions.ts` um `peak_phase` beim Speichern/Updaten berücksichtigen.

3. Admin-Tool
   - `FormState` in `src/routes/admin-warnungen.tsx` um `peakPhase` erweitern.
   - Eingabefeld im Formular unterhalb der Beschreibung hinzufügen (Label: „Stärkste Phase (optional)“).
   - Beim Laden einer Warnung (`edit`) wird `peakPhase` in den Formularstate übernommen.
   - Beim Speichern wird `peakPhase` mit an `saveWarning` übergeben.

4. Warnkarte
   - Im Info-Panel in `src/components/maps/warn-map.tsx` wird `peakPhase` angezeigt, falls vorhanden.
   - Darstellung als einfacher Textblock unterhalb der Beschreibung mit einem aussagekräftigen Label.

Nicht im Scope
   - Automatische Vorlagen füllen das Feld nicht aus (bleibt manuell).
   - Push-Benachrichtigungen zeigen die stärkste Phase nicht an.
   - Keine Filterung oder besondere visuelle Markierung in der Karte.

Technische Details
   - Spaltenname in Postgres: `peak_phase`.
   - Feldname im TypeScript-DTO: `peakPhase`.
   - Migration fügt ausschließlich die Spalte hinzu; bestehende Warnungen bleiben mit NULL, also ohne Anzeige.
