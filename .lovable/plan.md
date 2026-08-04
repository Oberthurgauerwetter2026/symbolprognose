# Regionskarte: Warnungen nur im Gültigkeitszeitraum anzeigen

## Ausgangslage

Die Regionskarte zeigt aktuell alle vom Server gelieferten Warnungen. Der Server liefert Warnungen bereits vor Beginn der Gültigkeit (Vorlaufzeit) mit — geprüft wird serverseitig nur `active` und `valid_to > jetzt`. Dadurch erscheinen in der Regionskarte auch Warnungen, deren Zeitfenster noch nicht begonnen hat.

## Ziel

In der Regionskarte (Symbolprognose) werden Warnungen und Vorinformationen nur angezeigt, solange `jetzt` zwischen Beginn und Ende liegt. Nach Ablauf verschwinden sie, ohne dass die Seite neu geladen werden muss.

## Umsetzung

- In der Regionskarte werden die Warnungen vor der Verwendung nach Zeitfenster gefiltert: `validFrom <= jetzt < validTo`.
- Der Filter wirkt auf alle drei Stellen, die Warnungen nutzen: Marker-Symbole je Ort, die höchste Warnstufe/Vorinformationsstufe und das Banner am oberen Kartenrand.
- Ein Minutentakt (bereits vorhandener Intervall-Mechanismus bzw. ein kleiner eigener Ticker) aktualisiert den Zeitbezug, damit eine ablaufende Warnung von selbst ausgeblendet wird.
- Andere Karten (Warnkarte, Lokalprognose) bleiben unverändert; dort ist die Vorlaufzeit gewünscht.

## Technische Details

- Datei: `src/components/region-map.tsx`
- Nach `const activeWarnings = useActiveWarnings()` eine gefilterte Liste `warningsNow` per `useMemo` bilden, abhängig von einem `nowMs`-State, der jede Minute erneuert wird.
- `spotWarnings` und `maxWarnLevel`/`maxAdvisoryLevel` verwenden `warningsNow` statt `activeWarnings`.
