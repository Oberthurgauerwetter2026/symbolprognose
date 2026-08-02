## Ziel
In der Warnkarten-Info-Anzeige soll der Hinweis "Vorinformation" nur noch über das UI-Label im Header erkennbar sein – der Warntitel und der Beschreibungstext sollen das Wort nicht mehr wiederholen.

## Aktueller Zustand
- `warningTitle(..., advisory=true)` in `src/lib/warnings-config.ts` gibt z. B. "Vorinformation Gewitter (Stufe 1)" zurück.
- `genTexts()` in `src/routes/admin-warnungen.tsx` setzt bei Vorinformationen der Beschreibung ein "Vorinformation: " voran.
- `src/components/maps/warn-map.tsx` entfernt das Präfix bereits im Titel-Header, nicht aber im Beschreibungstext.

## Geplante Änderungen
1. `src/lib/warnings-config.ts`: `warningTitle` bei `advisory=true` ohne "Vorinformation"-Präfix generieren (z. B. "Gewitterwarnung (Stufe 1)").
2. `src/routes/admin-warnungen.tsx`: `genTexts` erzeugt für `advisory=true` die normale Beschreibung ohne "Vorinformation: "-Präfix.
3. `src/components/maps/warn-map.tsx`: Bei der Anzeige von Beschreibungen alter Vorinformationen ggf. vorhandenes "Vorinformation:"-Präfix entfernen, damit auch bestehende Einträge sauber aussehen. Das Titel-Präfix wird weiterhin abgeschnitten, falls einmal vorhanden.

## Nicht geplant
- Keine Datenbank-Migration; bestehende Texte werden rein im UI bereinigt.
- Keine Änderung an der Schraffur, dem Vorinformation-Label oder der Push-Logik.
