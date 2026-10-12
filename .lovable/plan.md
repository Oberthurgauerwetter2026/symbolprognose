# Regionskarte: Warnbalken ab Erstellung der Warnung anzeigen

## Problem
Der Warnbalken über der Regionskarte richtet sich heute nach dem gewählten Zeitschritt (Stunde/Tag). Eine Warnung, die erst später gilt, erscheint im Balken erst, wenn man zu diesem Zeitpunkt blättert.

## Neu
- Der Warnbalken erscheint, sobald eine Warnung erstellt (und aktiv) ist — unabhängig davon, wann ihr Gültigkeitszeitraum beginnt und welcher Zeitschritt gewählt ist.
- Er verschwindet, sobald die Warnung abgelaufen ist (Gültigkeitsende vorbei) oder beendet wurde; der bestehende Minutentakt bleibt.
- Farbe/Text richten sich wie bisher nach der höchsten Stufe (Warnung vor Vorinformation).
- Die Warnsymbole an den Orten bleiben an den gewählten Zeitschritt gebunden (unverändert).

## Technisch
In `src/components/region-map.tsx` wird `maxWarnLevel`/`maxAdvisoryLevel` (nur für das Banner genutzt) aus einer eigenen Liste berechnet: alle Warnungen mit `validTo > nowMs` statt aus dem zeitschrittgefilterten `activeWarnings`. `spotWarnings` bleibt bei `activeWarnings`. Keine Backend-Änderung (der Server liefert bereits alle aktiven, nicht abgelaufenen Warnungen).
