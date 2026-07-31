# Vorinformation (schraffierte Warnstufen)

Ja, das ergibt Sinn: eine "Vorinformation" kennzeichnet erhöhte Neigung (z.B. Schauer/Gewitter), ohne wie eine gültige Warnung zu wirken. MeteoSchweiz/SRF nutzen dafür ebenfalls eine eigene, abgesetzte Darstellung. Umsetzung als Schraffur in der Warnfarbe.

## Was neu ist

1. Im Warn-Tool (`/admin-warnungen`) gibt es pro Warnung ein Häkchen "Vorinformation". Alles andere (Gefahr, Stufe, Gültigkeit, Text) bleibt gleich.
2. Warnkarte: Gemeinden mit einer Vorinformation werden in der Farbe der Warnstufe **schraffiert** dargestellt (diagonale Streifen), nicht flächig gefüllt. Liegt für eine Gemeinde sowohl eine echte Warnung als auch eine Vorinformation vor, gewinnt die echte Warnung (flächige Füllung).
3. Banner über der Symbol-Regionskarte: bei ausschliesslich Vorinformationen zeigt das Band einen schraffierten Hintergrund in der Stufenfarbe und den Text "Vorinformation" statt "Warnungen aktiv". Verlinkung auf die Warnkarte wie bisher.

Automatische Radar-Warnungen bleiben unverändert (echte Warnungen, 30-Minuten-Vorlauf). Push-Meldungen für Vorinformationen bleiben ausgeschaltet — Vorinformation ist rein visuell.

## Technische Details

- Migration: `ALTER TABLE public.warnings ADD COLUMN advisory boolean NOT NULL DEFAULT false;` (keine neuen Tabellen, bestehende Policies/Grants gelten weiter).
- `src/lib/warnings.functions.ts`: `advisory` in Input-Validator und Save-Payload aufnehmen; `WarningDTO` um `advisory: boolean` erweitern, Mapping in `src/lib/warnings-dto.server.ts`.
- `src/routes/admin-warnungen.tsx`: Checkbox "Vorinformation" im Formular, Wert beim Laden/Speichern mitführen.
- `src/components/maps/warn-map.tsx`: neben `levelByRegion` eine `advisoryByRegion`-Ableitung; SVG-`<pattern>`-Definition (diagonale Streifen in Stufenfarbe) einmalig im Karten-Wrapper; für Vorinformations-Regionen `fillPattern`-Style bzw. reduzierte Deckkraft plus überlagerte Schraffur-Ebene. Legende erhält eine Zeile "schraffiert = Vorinformation".
- `src/components/region-map.tsx`: Banner-Ableitung um Vorinformation ergänzen (Text/Hintergrund via CSS `repeating-linear-gradient`).
- Warn-Chips/Infopanel-Texte bleiben unverändert.
