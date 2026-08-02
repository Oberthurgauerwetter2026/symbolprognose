# Vorschau-Hinweis zeigt Aktualisierungszeit

## Änderung

In der Sektion „Vorschau Warnkarte“ im Admin-Tool wird der Hinweistext „So sehen Besucherinnen und Besucher die Karte. Die Vorschau wird nach jedem Speichern aktualisiert.“ ersetzt durch die Angabe, wann die Vorschau letztmals aktualisiert wurde, z. B.:

```text
Aktualisiert: 02.08.2026, 11:42
```

Der Zeitstempel setzt sich bei jedem Neuaufbau der Vorschau (nach jedem Speichern, Aktivieren/Deaktivieren oder Löschen) neu.

## Technische Details

- `src/routes/admin-warnungen.tsx`, `MapPreviewSection`: `refreshKey` in einem `useEffect` beobachten und `new Date()` in einen State schreiben; Ausgabe formatiert mit `de-CH` (Datum + Stunde/Minute). Der Absatz ersetzt den bisherigen Text.
- Der Zeitstempel wird erst clientseitig gesetzt (Vermeidung von SSR-Mismatch).
