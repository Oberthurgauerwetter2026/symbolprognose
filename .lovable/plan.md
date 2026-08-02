# Warnkarte aktualisiert sofort statt erst nach Neuladen

## Problem

Die Warnkarte holt die Warnungen aktuell nur alle 5 Minuten neu (und betrachtet die Daten 60 Sekunden lang als frisch). Wird im Admin-Tool eine Warnung neu erfasst, geändert oder deaktiviert, erscheint sie in der Karte deshalb erst nach bis zu 5 Minuten – oder nach manuellem Neuladen der Seite.

## Lösung

1. **Live-Aktualisierung**: Die Karte hört auf Änderungen der Warnungs-Tabellen im Backend (Realtime). Sobald eine Warnung gespeichert, aktiviert, deaktiviert oder gelöscht wird, lädt die Karte die Daten innerhalb von Sekunden neu – ohne Neuladen der Seite.
2. **Kürzeres Polling als Sicherheitsnetz**: Abfrageintervall von 5 Minuten auf 60 Sekunden, Daten nicht mehr künstlich „frisch“ halten.
3. **Neu laden bei Rückkehr auf die Seite/Tab**: Wechselt der Nutzer zurück in den Tab oder wird die App (PWA) wieder in den Vordergrund geholt, wird sofort neu geladen.
4. **Dezenter „Aktualisiert vor X“-Hinweis** bleibt wie bisher bzw. spiegelt den neuen Zeitstempel.

Das gilt automatisch für alle drei Ansichten: `/karten/warnungen`, die Standalone-Warnkarte `/warnkarte` und den Embed `/embed/warnungen`.

## Technische Details

- `src/components/maps/warn-map.tsx`:
  - `useQuery(["warnings"])`: `refetchInterval: 60_000`, `staleTime: 0`, `refetchOnWindowFocus: true`.
  - Neuer `useEffect`: Supabase-Realtime-Channel auf `postgres_changes` für die Tabellen `warnings` und `warning_regions` (Events INSERT/UPDATE/DELETE) → `queryClient.invalidateQueries({ queryKey: ["warnings"] })`, debounced (~300 ms), Channel-Cleanup beim Unmount.
  - Zusätzlicher `visibilitychange`-Listener für PWA/Mobile-Fälle, in denen Focus-Events ausbleiben.
- Realtime-Voraussetzung: Migration, die `warnings` und `warning_regions` zur Publication `supabase_realtime` hinzufügt und `REPLICA IDENTITY FULL` setzt. Öffentliche Lesbarkeit ist über die bestehenden Policies gegeben; es werden keine zusätzlichen Rechte vergeben.
- Fällt Realtime aus (z. B. blockierte WebSockets im WP-iframe), greift weiterhin das 60-Sekunden-Polling.
