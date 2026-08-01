# Schraffur-Kontrast in Gefahren-Chips reduzieren

## Ziel

Die Schraffur in Vorinformation-Chips soll weniger extrem kontrastieren, damit die Beschriftung (Gefahrenart und Stufenzahl) weiterhin gut lesbar bleibt.

## Beobachtung

Aktuell wird der Chip mit `repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0 3px, transparent 3px 6px)` über der Stufenfarbe gelegt. Die dunklen Streifen über dem Gelb (Stufe 1) lassen die Schrift härter lesbar wirken.

## Geplante Änderung

- In `src/components/maps/warn-map.tsx`, Zeile 411:
  - `rgba(0,0,0,0.18)` → `rgba(0,0,0,0.08)` oder `rgba(0,0,0,0.10)`
  - Streifen bleiben erkennbar, Kontrast reduziert sich merklich.
- Alternativ: `rgba(255,255,255,0.22)` als hellere Schraffur prüfen, falls dunkle Streifen generell zu dominant wirken.
- Keine weiteren Dateien betroffen; Chip-Verhalten und Farben bleiben gleich.

## Nicht im Scope

- Keine Änderung an Karten-Schraffur, Legende oder Infopanel.
- Keine Daten-/Logik-Änderungen.
