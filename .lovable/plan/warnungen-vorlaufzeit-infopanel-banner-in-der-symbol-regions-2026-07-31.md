# Warnungen: Vorlaufzeit, Infopanel, Banner in der Symbol-Regionskarte

## 1. Automatische Radar-Warnung erst 30 Minuten vor Eintreffen

In der automatischen Gewittererkennung wird derzeit für jede Gemeinde eine Warnung erstellt, sobald im Prognosefeld (bis 3 Stunden voraus) eine Zelle über der Schwelle liegt. Neu gilt:

- Regionen, deren erster Treffer weiter als 30 Minuten in der Zukunft liegt, erzeugen noch keine Warnung.
- Bei Regionen innerhalb der 30-Minuten-Grenze beginnt die Gültigkeit frühestens 30 Minuten vor dem erwarteten Eintreffen (bzw. jetzt, falls die Zelle bereits da ist).
- Regionen, die dadurch (noch) nicht gewarnt sind, gelten weiterhin als "nicht erkannt" — bestehende Autowarnungen dort werden wie bisher beendet.

Die Zugbahn-/Geschwindigkeitsangabe im Warntext bleibt unverändert.

## 2. Infopanel: Quellenangabe entfernen

Im Warn-Infopanel der Warnkarte entfällt der Zusatz "· automatisch (Radar)" in der Gültigkeitszeile. Automatische und manuelle Warnungen sehen für Nutzer identisch aus.

## 3. Warnbanner in der Symbol-Regionskarte

Über der Symbol-Regionskarte erscheint — nur wenn für mindestens eine dargestellte Gemeinde eine Warnung aktiv ist — ein schmales Band:

- Hintergrund in der Farbe der höchsten aktiven Warnstufe (Stufe 1 gelb, 2 orange, 3 rot), Textfarbe passend zum Kontrast.
- Links ein Ausrufezeichen-Symbol, danach der Text "Warnungen aktiv".
- Das ganze Band ist klickbar und führt zur Warnkarte.
- Höhe bewusst schmal (eine Zeile), abgerundet passend zur Karte, auch im Embed- und Fill-Modus sichtbar.

## Technische Details

- `src/lib/auto-thunder.server.ts`: neue Konstante `LEAD_MS = 30 * 60_000`; in der Schleife über `perRegion` Regionen mit `info.firstMs > now + LEAD_MS` überspringen und aus der Aktiv-Liste für `closeStale` ausschliessen; `validFrom = new Date(Math.min(Math.max(now, info.firstMs - LEAD_MS), info.firstMs))`.
- `src/components/maps/warn-map.tsx` (Zeile ~605): Ausdruck `{w.source === "auto" ? " · automatisch (Radar)" : ""}` entfernen.
- `src/components/region-map.tsx`: aus dem bereits vorhandenen `spotWarnings` das Maximum der Stufen ableiten; Banner oberhalb des Karten-Wrappers im Return rendern, Farben aus `LEVELS` in `@/lib/warnings-config`. Verlinkung: in der App per `Link to="/karten/warnungen"`; im `bare`-Modus (Embed) als `<a target="_blank">` auf `${SITE_URL}/warnkarte`.
- Keine Datenbank- oder Schema-Änderungen.
