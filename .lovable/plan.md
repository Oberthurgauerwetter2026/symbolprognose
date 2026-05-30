Do I know what the issue is? Ja.

Der weiße Bildschirm kommt weiterhin aus dem TanStack-Router-Hydration-Pfad, nicht aus ICON-EPS. Die aktuellen Logs zeigen zwei passende Fehler:

- `AwaitInner` ruft intern React `use()` auf und landet in `Invalid hook call`.
- Zusätzlich gibt es den bekannten TanStack-SPA-Hydration-Fehler `Expected to find a match below the root match in SPA mode`.

Die Codebasis hat aktuell nicht zusammengezogene TanStack-Versionen:

- `@tanstack/react-start` ist auf `1.168.10`
- `@tanstack/react-router` ist auf `1.170.7`
- `@tanstack/router-plugin` ist auf `1.168.10`
- der Lockfile zieht `@tanstack/router-core@1.171.5`

Die offiziellen aktuellen Patch-Versionen sind kompatibler zueinander und ziehen `router-core@1.171.8`, wo genau dieser SPA-Hydration-Fall entschärft wurde. Deshalb muss der Fix jetzt nicht mehr nur im App-Code passieren, sondern über saubere TanStack-Patch-Versionen plus frischen Vite-Dependency-Cache.

Plan zur Umsetzung:

1. **TanStack-Versionen synchronisieren**
   - `@tanstack/react-start` auf `1.168.18`
   - `@tanstack/react-router` auf `1.170.10`
   - `@tanstack/router-plugin` auf `1.168.13`
   - Lockfile aktualisieren, damit `@tanstack/router-core@1.171.8` verwendet wird.

2. **Alte Persist-Pakete entfernen**
   - `@tanstack/react-query-persist-client` und `@tanstack/query-sync-storage-persister` entfernen, weil der Code sie nicht mehr nutzt.
   - Dadurch kann der alte Query-Persist-Hydration-Pfad nicht versehentlich wieder in den Bundle kommen.

3. **Root-Cleanup sauber machen**
   - Das Entfernen von `wx-rq-cache-v1` aus `localStorage` aus dem Render-Pfad in einen `useEffect` verschieben.
   - Damit bleibt `RootComponent` rein und hydration-sicher.

4. **Start-Middleware vervollständigen**
   - CSRF-Middleware ergänzen, damit die aktuelle TanStack-Start-Warnung verschwindet.
   - `attachSupabaseAuth` als `functionMiddleware` registrieren, damit Server Functions zuverlässig Auth-Header bekommen.

5. **Preview hart neu laden**
   - Dev-Server neu starten, damit Vite die optimierten `node_modules/.vite/deps/*` neu erzeugt.
   - Danach `/` im Browser öffnen und prüfen, dass keine `AwaitInner`-/`Invalid hook call`-Fehler mehr auftauchen.

6. **Falls dein Browser noch weiß bleibt**
   - Zusätzlich eine einmalige, app-seitige Cache-Cleanup-Strategie prüfen, aber erst nach dem Versionsfix — der Versionsmix ist der primäre Fehler.

Unverändert bleibt:

- Kein ICON-EPS wird wieder eingeführt.
- Die ICON-CH1/ICON-CH2-Logik bleibt wie gewünscht bestehen.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>