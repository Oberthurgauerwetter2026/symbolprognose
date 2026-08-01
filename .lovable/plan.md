# Push-Symbole an Kartensymbole angleichen

## Ziel
Die Symbole in den Push-Benachrichtigungen sollen exakt dieselben Gefahren-Symbole zeigen wie die Warnkarte (Blitz, Regentropfen, Schneeflocken, Strassenglätte, Windsack, Frost) – inklusive der Stufenfarbe (Gelb/Orange/Rot).

## Ausgangslage
- Die Karte zeichnet die Symbole als SVG in `src/components/warnings/hazard-icons.tsx`.
- Der Push versendet stattdessen fertige Bilddateien aus `public/warn-icons/<gefahr>-<stufe>.png`, die früher separat erstellt wurden und nicht mit den Kartensymbolen übereinstimmen.

## Vorgehen
1. Die SVG-Definitionen der 6 Gefahrensymbole in ein gemeinsames, framework-neutrales Modul auslagern (reine Pfad-/Markup-Daten), damit Karte und Icon-Erzeugung garantiert dieselbe Quelle nutzen. Die Karten-Komponenten rendern weiterhin unverändert dasselbe Ergebnis.
2. Ein Generator-Skript ergänzt, das aus diesen Definitionen die 18 PNGs (6 Gefahren × 3 Stufen, 192×192) neu erzeugt: Symbol in weiss auf abgerundetem Hintergrund in der Stufenfarbe (`#f2c53d`, `#ef8b30`, `#d63b32`) aus `warnings-config.ts`.
3. Skript einmal ausführen und die Dateien in `public/warn-icons/` ersetzen (gleiche Namen, daher keine Änderung an `push.server.ts` nötig).
4. Kontrolle: Die generierten PNGs visuell mit der Karten-Legende vergleichen.

## Technische Details
- Rasterisierung erfolgt lokal über einen Headless-Browser-Screenshot der SVGs (keine neue Runtime-Abhängigkeit im App-Bundle).
- Dateinamen-Schema `<hazardId>-<level>.png` bleibt bestehen; `icon`-URL-Aufbau in `src/lib/push.server.ts` bleibt unverändert.
- Badge/Emoji-Titel-Logik im Push bleibt unangetastet.
