# Warn-Tool aufräumen, Ablauf automatisieren, Push-Titel mit Ort

## 1. Abgelaufene Warnungen automatisch entfernen

Aktuell werden nur automatische Radar-Warnungen beendet; manuell erfasste Warnungen bleiben nach Ablauf der Gültigkeit als „aktiv" in der Liste stehen (öffentlich sind sie bereits gefiltert).

Neu: eine serverseitige Aufräumfunktion setzt jede Warnung mit `valid_to < jetzt` auf inaktiv – unabhängig von der Quelle. Sie läuft
- bei jedem Lauf der Gewitter-Automatik (alle 5 Minuten) und
- jedes Mal, wenn das Warn-Tool die Liste lädt.

Im Warn-Tool erscheinen abgelaufene Einträge damit nicht mehr in der Liste der aktiven Warnungen, sondern nur noch unter „beendet/abgelaufen" (Historie bleibt erhalten, nichts wird gelöscht).

## 2. „Datenquellen / Ingest" aus dem Tool entfernen, Kartenvorschau einführen

- Der Block „Datenquellen / Ingest" (Statusampeln + manuelle Start-Buttons) wird aus dem Warn-Tool entfernt. Die zugehörigen Server-Funktionen bleiben bestehen und werden weiter vom Cron genutzt.
- An seiner Stelle steht ein Vorschaufenster mit der Warnkarte, wie sie öffentlich aussieht (kompakte Höhe, Klick auf Gemeinde zeigt die Warnungen). So lässt sich eine neu erfasste Warnung direkt kontrollieren.
- Die Vorschau wird nach dem Speichern/Deaktivieren einer Warnung neu geladen.
- Der Block „Gewitter-Autowarnung" bleibt unverändert.

## 3. Push-Titel mit Ortsangabe

Statt `Gewitterwarnung (Stufe 3)` heisst der Titel künftig:

```text
⚡️ Gewitterwarnung (Stufe 3) für Amriswil
```

Bei mehreren betroffenen Gemeinden werden bis zu zwei Namen genannt, danach gekürzt: `für Amriswil, Romanshorn +3`. Der bisherige Text (Beschreibung, Gültigkeit, Link) bleibt gleich; die Zeile „from Oberthurgauer Wetter" ist die von iOS erzwungene App-Zeile und lässt sich nicht entfernen.

## Technische Umsetzung

- `src/lib/warnings.server.ts`: neue Funktion `deactivateExpired()` (Update `active = false` für `active = true AND valid_to < now()`), aufgerufen in `adminListWarnings` (`src/lib/warnings.functions.ts`) und in `runAutoThunder` (`src/lib/auto-thunder.server.ts`, ersetzt die reine Auto-Prüfung in `closeStale`).
- `src/routes/admin-warnungen.tsx`: `IngestSection` samt Imports aus `@/lib/ingest-admin.functions` entfernen; neue `MapPreviewSection` mit `WarnMap` (`bare`-Variante) einsetzen; Liste trennt aktive und abgelaufene Einträge.
- `src/lib/push.server.ts`: Titel um ` für <Ort(e)>` erweitern (Regionsnamen bereits über `regionName` verfügbar).
