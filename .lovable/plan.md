# Warnkarte-Chips zurücksetzen, Banner-Schrift lesbar machen

## 1. Gefahren-Leiste in der Warnkarte (wie vorher)

Die Chips (Alle, Gewitter, Regen, …) zeigen bei Vorinformationen aktuell nur eine farbige Kontur mit farbiger Schrift — bei Gelb praktisch unlesbar. Sie werden wieder wie im vorigen Zustand dargestellt:

- Vollflächige Stufenfarbe als Hintergrund mit Kontrastschrift, unabhängig davon, ob es eine Warnung oder eine Vorinformation ist.
- Stufenzahl wieder als Chip auf dem farbigen Grund.
- Keine gesonderte Outline-Variante mehr.

## 2. Banner in der Symbol-Regionskarte

Der Text „Vorinformation“ steht momentan in der Stufenfarbe (bei Stufe 1 gelb) auf hellem Grund. Neu:

- Schrift in dunkler Vordergrundfarbe statt in der Stufenfarbe — dadurch bei Gelb, Orange und Rot gleich gut lesbar.
- Ausrufezeichen-Chip bleibt solide in der Stufenfarbe mit Kontrastschrift.
- Dezente Schraffur am linken Rand, ruhiger Grund und Akzentkante bleiben unverändert.
- Echte Warnungen (vollflächige Stufenfarbe) bleiben unverändert.

## Technisch

- `src/components/maps/warn-map.tsx`: im Chip-Style-Block (~Z. 400–422) die `adv`-Outline-Variante entfernen; Farbe aus `max(lvl, adv)` ziehen und wie bisher `background: LEVELS[x].color` / `color: LEVELS[x].textOnColor` setzen.
- `src/components/region-map.tsx`, `warnBanner`: im `isAdvisory`-Style `color` auf einen dunklen Token-Wert (`hsl(var(--foreground))` bzw. entsprechende CSS-Variable) setzen statt `def.color`.
- Keine Backend- oder Datenänderungen.
