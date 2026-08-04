# Regionskarte: Vorlaufzeit anzeigen, abgelaufene ausblenden

## Ziel
Warnungen sollen in der Regionskarte schon vor Beginn (Vorlaufzeit) sichtbar sein, aber nach Ablauf des Gültigkeitsendes automatisch verschwinden.

## Änderung
In `src/components/region-map.tsx` wird der Warnfilter angepasst:

- Aktuell: nur anzeigen, wenn `validFrom <= jetzt < validTo`.
- Neu: anzeigen, solange `jetzt < validTo` — unabhängig davon, ob die Warnung erst später beginnt.

Damit gilt:
- Kommende Warnungen (Vorlaufzeit) erscheinen in Markern, Warnstufen und Banner.
- Abgelaufene Warnungen werden weiterhin im Minutentakt automatisch entfernt (bestehender Ticker bleibt).

## Technisch
Eine Filterbedingung in `activeWarnings` (useMemo) ändern; keine weiteren Komponenten oder Backend-Anpassungen nötig.
