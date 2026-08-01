# Gefahren-Chips bei Vorinformation schraffiert

## Ziel

In der Gefahren-Leiste der Warnkarte (Gewitter, Regen, Wind, …) sollen Chips, die ausschliesslich auf eine Vorinformation hinweisen, wie auf der Karte selbst schraffiert dargestellt werden. Echte Warnungen bleiben vollflächig in der Stufenfarbe.

## Verhalten neu

- Ist für eine Gefahrenart **keine** aktive Warnung vorhanden, aber eine Vorinformation (z. B. Gewitter-Vorinformation Stufe 1), erhält der Chip die Stufenfarbe als schraffierten Hintergrund.
- Ist eine echte Warnung vorhanden, bleibt der Chip vollflächig gefärbt (bisheriges Verhalten).
- Sind beide Arten vorhanden, gewinnt die echte Warnung (keine Schraffur).
- Textfarbe, Icon und Stufen-Chip bleiben erhalten.
- Tooltip/Title zeigt weiterhin „Vorinformation“ an.

## Technische Details

- Datei: `src/components/maps/warn-map.tsx`, Chip-Block (ca. Zeile 401–418).
- Änderungen:
  - `const isAdvisory = lvl === 0 && adv > 0;` bestimmen.
  - Beim `style`:
    - `isAdvisory` → `background: repeating-linear-gradient(45deg, <LEVELS[shown].color> 0 3px, transparent 3px 6px)` und `color: LEVELS[shown].textOnColor`.
    - Sonst bisheriger solider Hintergrund.
  - Titel-Attribut und Klassen bleiben unverändert.
- Keine Änderungen an Datenbank, Server-Funktionen, Push oder Kartengeometrie.

## Nicht im Scope

- Keine Änderung der Karten-Schraffur oder der Infopanel-Darstellung.
- Keine neue Farblegende oder Textänderungen.
