# Gewitter Stufe 1: Beschreibung ergänzen

Bei Gewitter Stufe 1 nennt die automatisch erzeugte Beschreibung im Warn-Tool nur „Örtlich Gewitter.“ – Wind, Starkregen und Hagel fehlen, obwohl sie bereits ab Stufe 1 möglich sind.

## Änderung

In der Warntext-Vorlage für Gewitter Stufe 1:

- Beschreibung neu: „Örtlich Gewitter mit kurzzeitigem Starkregen, kleinem Hagel und Windböen.“ – der optionale Zusatz mit den erwarteten Böenspitzen bleibt erhalten.
- Mögliche Auswirkungen entsprechend ergänzt (Starkregen, nasse Fahrbahnen, eingeschränkte Sicht, örtlich kleiner Hagel).

Stufe 2 und 3 bleiben unverändert.

## Technisch

- `src/lib/warnings-config.ts`: `TEMPLATES.gewitter[1].description` und `.impact` anpassen. Damit ändern sich automatisch das Admin-Tool, Push-Texte und die Warnkarte.
- Bereits erfasste Warnungen mit manuell angepasstem Text werden nicht überschrieben (bestehende `genTexts`-Logik).
