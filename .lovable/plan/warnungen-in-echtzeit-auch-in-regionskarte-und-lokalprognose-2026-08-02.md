# Warnungen in Echtzeit auch in Regionskarte und Lokalprognose

## Ausgangslage

Nur die Warnkarte (`warn-map.tsx`) hört live auf Änderungen an den Warnungen. Regionskarte
(`region-map.tsx`) und Lokalprognose (`weather-widget.tsx`) holen ihre Warnungen über den Hook
`useActiveWarnings`, der nur alle 5 Minuten neu lädt (`staleTime`/`refetchInterval` = 5 min).
Neu erfasste oder deaktivierte Warnungen erscheinen dort deshalb verspätet.

## Was gebaut wird

1. Gemeinsamer Realtime-Hook für Warnungen
   - Neuer Hook (in `src/hooks/use-warnings.ts`), der eine Realtime-Subscription auf die Tabellen
     `warnings` und `warning_regions` aufbaut und bei Änderungen den React-Query-Cache
     (Key `["warnings"]`, inkl. `["warnings","active"]`) invalidiert.
   - Entprellt (300 ms) wie bisher in der Warnkarte, plus Auffrischen bei
     `visibilitychange` (Tab wieder aktiv).
   - Kanalname pro Hook-Instanz eindeutig, damit mehrere Karten auf einer Seite sich nicht
     gegenseitig abmelden.
   - Aufräumen im Cleanup (`removeChannel`), damit keine Subscriptions leaken.

2. `useActiveWarnings` nutzt diesen Hook
   - `staleTime` auf 0 und `refetchInterval` auf 60 s (wie Warnkarte), damit Realtime plus
     kurzer Fallback-Poll greifen.
   - Query-Key so ausrichten, dass die Invalidierung beide Karten trifft.

3. Warnkarte auf den gemeinsamen Hook umstellen
   - Der bestehende `useEffect`-Block in `warn-map.tsx` wird durch den gemeinsamen Hook ersetzt;
     Verhalten bleibt identisch.

## Technische Hinweise

- Realtime ist für `warnings` und `warning_regions` bereits in der Publikation aktiv (in einem
  früheren Schritt eingerichtet), es ist keine Migration nötig.
- Betroffene Dateien: `src/hooks/use-warnings.ts`, `src/components/maps/warn-map.tsx`
  (Vereinfachung), keine Änderung an `region-map.tsx` / `weather-widget.tsx` nötig, da sie
  den Hook schon verwenden.

## Prüfung

Warnung im Admin-Tool aktivieren/deaktivieren und in Regionskarte sowie Lokalprognose ohne
Neuladen die Aktualisierung beobachten.
