# Vorinformation-Texte anpassen

## Ziel
Wenn eine Warnung als **Vorinformation** erfasst wird, soll der Text auf ein mögliches Ereignis hinweisen – nicht auf eine bereits feststehende Gefahr. Die „Möglichen Auswirkungen“ bleiben dabei leer, da sie bei einer reinen Vorinformation nicht sinnvoll bekannt sind.

## Vorgeschlagene Vorinformation-Texte pro Gefahr und Stufe

| Gefahr | Stufe 1 | Stufe 2 | Stufe 3 |
|--------|---------|---------|---------|
| Gewitter | Erhöhte Schauer- und Gewitterneigung. | Deutlich erhöhte Gewitterneigung. | Hohe Wahrscheinlichkeit für starke Gewitter. |
| Regen | Erhöhte Regenneigung. | Deutlich erhöhte Niederschlagsneigung. | Hohe Wahrscheinlichkeit für kräftigen Regen. |
| Wind | Erhöhte Windböen möglich. | Deutlich erhöhte Böen möglich. | Hohe Wahrscheinlichkeit für stürmische Böen. |
| Schnee | Erhöhte Schneefallneigung. | Deutlich erhöhte Schneefallneigung. | Hohe Wahrscheinlichkeit für kräftigen Schneefall. |
| Strassenglätte | Erhöhte Glättegefahr. | Deutlich erhöhte Glättegefahr. | Hohe Wahrscheinlichkeit für grössere Vereisung. |
| Frost | Frost möglich. | Deutlich frostige Bedingungen möglich. | Hohe Wahrscheinlichkeit für strengen Frost. |

- Titel: bleibt unverändert, z.B. „Gewitterwarnung (Stufe 1)“.
- Mögliche Auswirkungen: wird bei Vorinformationen leer gelassen.
- Die Schwellen- und Messwert-Eingabe bleibt im Admin-Tool weiterhin sichtbar, damit der Redaktor bei Bedarf die passende Stufe wählen kann.

## Umsetzung

1. **`src/lib/warnings-config.ts`**
   - Neue Vorlagengruppe `ADVISORY_TEMPLATES: Record<HazardId, Record<WarnLevel, Template>>` einführen.
   - Die Beschreibung nutzt die oben vorgeschlagenen Texte; `impact` und `advice` bleiben leer.

2. **`src/routes/admin-warnungen.tsx`**
   - `genTexts` akzeptiert den `advisory`-Parameter und wählt bei `true` die Vorinformation-Vorlagen statt `TEMPLATES`.
   - Bei `advisory` wird `impact` leer zurückgegeben.
   - Beim Aktivieren/Deaktivieren der Vorinformation-Checkbox werden die Texte automatisch neu generiert, sofern der Redaktor sie nicht manuell angepasst hat.

3. **`src/components/maps/warn-map.tsx`**
   - Sicherstellen, dass die „Mögliche Auswirkungen“-Sektion nur angezeigt wird, wenn `impact` nicht leer ist.

4. **Test / Vorschau**
   - Im Admin-Tool eine Vorinformation für jede Gefahr anlegen und prüfen, ob Titel, Beschreibung und leerer Auswirkungsblock korrekt dargestellt werden.
   - Vorhandene Vorinformationen in der Karte anzeigen, um das veränderte Verhalten zu verifizieren.
