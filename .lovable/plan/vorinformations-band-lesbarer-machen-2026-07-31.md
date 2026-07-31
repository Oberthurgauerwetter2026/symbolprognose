# Vorinformations-Band lesbarer machen

Das Band über der Symbol-Regionskarte ist momentan vollflächig grob schraffiert (Gelb/Schwarz, 8px), der Text liegt direkt auf der Schraffur und ist kaum lesbar.

## Ziel

Vorinformation bleibt visuell als "schraffiert" erkennbar, aber deutlich ruhiger — Text jederzeit klar lesbar.

## Umsetzung

- Grundfläche: heller, ruhiger Untergrund in der Stufenfarbe (z. B. Stufenfarbe mit geringer Deckkraft auf hellem Grund) statt Vollkontrast-Schraffur.
- Schraffur nur noch dezent: feinere Linien, geringere Deckkraft, und nur als schmaler Streifen am linken Rand bzw. flächig mit stark reduzierter Sichtbarkeit — nicht mehr über dem Text.
- Text: kräftige, dunkle Schrift in Stufenfarbe/Foreground ohne Textschatten, auf schraffurfreiem Bereich.
- Ausrufezeichen-Chip: solide Stufenfarbe mit Kontrastschrift, gleiche Grösse wie bisher.
- Echte Warnungen (nicht advisory) bleiben unverändert vollflächig in der Stufenfarbe.

## Technisch

- Datei: `src/components/region-map.tsx`, Block `warnBanner` (Style-Zweig `isAdvisory`).
- `repeating-linear-gradient` bekommt feineres Raster (z. B. 6px) und läuft über eine `rgba`-Variante der Stufenfarbe; Text erhält einen eigenen, nicht schraffierten Träger (kleiner solider Hintergrund-Chip oder Overlay-Ebene).
- `textShadow` entfällt.
- Gleiche Behandlung im Embed-Modus (`bare`) und in der normalen Ansicht — beides nutzt denselben Style.
