## Ziel

Die automatisch erzeugten Gewitterwarnungen (`runAutoThunder`) verwenden denselben knappen Textstil wie die manuellen Vorlagen: kurzer Ereignissatz, danach ein Messwertsatz, danach optional die Zugbahn.

## Neuer Textaufbau

Bisher: «Örtlich Gewitter. Radar und Nowcast zeigen Spitzenintensitäten um 22 mm/h. Die Zellen ziehen mit rund 35 km/h aus Südwesten heran.»

Neu: «Kräftige Gewitter mit Starkregen und Hagel. Erwartete Spitzenintensitäten 22 mm/h. Zellen ziehen mit rund 35 km/h aus Südwesten heran.»

- Satz 1 stammt unverändert aus `TEMPLATES.gewitter[level].description` (ohne Messwert-Baustein, da dieser bei Gewitter Böenspitzen meint).
- Satz 2 ist der Intensitätssatz aus dem Nowcast: «Erwartete Spitzenintensitäten X mm/h.»
- Satz 3 nur, wenn eine Verlagerung erkannt wurde: «Zellen ziehen mit rund X km/h aus Südwesten heran.»
- Auswirkungen und Verhaltenshinweis bleiben `templateImpact(tpl)` und damit identisch zu den manuellen Warnungen (bereits gekürzt).

## Technisch

- `src/lib/auto-thunder.server.ts`: nur der Aufbau des `description`-Strings wird angepasst; Schwellen, Zeitfenster, Regionszuordnung, `auto_key`, Push und Aufräumlogik bleiben unverändert.
- `params.value` bleibt der gerundete mm/h-Wert, damit der Wert im Admin-Tool beim Bearbeiten weiterhin erscheint.
- Bestehende aktive Auto-Warnungen werden beim nächsten 5-Minuten-Lauf automatisch mit dem neuen Text aktualisiert.
- Kurzprüfung: Typecheck und Gegenlesen der erzeugten Sätze für Stufe 1/2/3 mit und ohne erkannte Zugbahn.
