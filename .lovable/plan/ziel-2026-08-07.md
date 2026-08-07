Vorinformationen nach „keine Gefahr“ einreihen

## Ziel
Vorinformationen sollen in der Warnkarte als weniger dringend behandelt werden als jede aktive Warnung (Stufe 1–3). In Listen sortieren sie daher nach allen echten Warnungen, aber vor dem „keine Warnung“-Zustand.

## Annahme zur Umsetzung
Aktuell werden Warnungen primär nach `level` sortiert. Eine Vorinformation der Stufe 3 kann deshalb vor einer echten Stufe-1-Warnung erscheinen. Neu bestimmt zuerst der Flag `advisory` die Reihenfolge (echte Warnungen zuerst), innerhalb der beiden Gruppen bleibt die Stufe absteigend, danach Gültigkeit (`validTo`).

## Betroffene Stellen
- `src/lib/warnings-lookup.ts` – Funktion `warningsForRegion` sortiert neu: echte Warnungen vor Vorinformationen, dann Stufe, dann Ablauf.
- `src/components/maps/warn-map.tsx` – `selectedWarnings` nutzt dieselbe Sortierung, damit das Info-Panel die Reihenfolge korrekt widerspiegelt.
- `src/components/region-map.tsx` – Loop über `warningsForRegion` und `topWarningFor` profitieren automatisch von der neuen Sortierung.
- `src/components/weather-widget.tsx` – Lokalprognose-Widget zeigt die relevanteste Warnung zuerst.
- `src/lib/embed-noscript.server.ts` – eigene Sortierung `.sort((a, b) => b.level - a.level)` wird ebenfalls angepasst, damit Embeds konsistent sind.

## Nicht betroffen
- Karten-Füllung: Vorinformationen bleiben schraffiert und werden nur angezeigt, wenn keine echte Warnung für die Region aktiv ist (bestehendes Verhalten).
- Banner-Chips in der Warnkarte: Reihenfolge nach Gefahrenart bleibt unverändert.
- Push-Benachrichtigungen: Vorinformationen lösen ohnehin keinen Push aus.
