## Problem
Der weiße Bildschirm kommt weiterhin vom bekannten Client-Fehler:

```text
Invalid hook call
AwaitInner -> React.use(...)
```

Ich konnte die Seite in meiner frischen Browser-Session sehen, aber deine Session hängt offenbar weiter an genau diesem Fehlerpfad. Im Code ist noch `PersistQueryClientProvider` aktiv; dieser kann beim Hydratisieren eines alten lokalen Query-Caches Router-`Await`/React-`use()` triggern und in der bestehenden Preview-Session wieder weiß rendern.

## Plan
1. **Persistenten Query-Cache abschalten**
   - In `src/routes/__root.tsx` `PersistQueryClientProvider`, `createSyncStoragePersister` und den `wx-rq-cache-v1`-Persister entfernen.
   - Root nur noch mit stabilem `QueryClientProvider` rendern.
   - Damit kann ein kaputter/alter Browser-Cache die App nicht mehr beim Start crashen.

2. **Router-/Query-Versionen konsistent machen**
   - `package.json` so anpassen, dass TanStack Query, Router, Start und Router-Plugin auf kompatiblen Versionen bleiben und nicht durch gemischte Minor-Versionen auseinanderlaufen.
   - Falls nötig Lockfile durch Installation aktualisieren.

3. **Start-Middleware vervollständigen**
   - `src/start.ts` prüfen/anpassen, damit bestehende Server-Function-Auth-Middleware korrekt registriert ist, falls Server Functions Auth brauchen.
   - Nur falls im Projekt vorhanden und nötig; keine Backend-Logik ändern.

4. **Preview gezielt validieren**
   - Dev-Server neu starten, damit alte Vite/HMR-Bundles verschwinden.
   - `/` im Browser prüfen: sichtbarer Inhalt statt Weißbildschirm.
   - Console auf `AwaitInner`/`Invalid hook call` prüfen.

## Nicht Teil dieses Fixes
- Keine Rückkehr zu ICON-EPS.
- Keine Änderung an Radar-/Forecast-Logik.
- Keine Datenbank- oder Backend-Migration.