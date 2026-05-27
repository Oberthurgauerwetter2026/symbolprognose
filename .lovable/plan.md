# Radar-Pipeline: Cloudflare Cron Trigger statt GitHub-Cron

## Ziel
Die unzuverlässigen Aussetzer kommen daher, dass `radar-ingest.yml` per GitHub-`schedule:`-Cron läuft — GitHub Actions verzögert/überspringt Schedules regelmäßig (oft 10–30 min). Die MCH-Pipeline (HDF5 → PNG → R2) selbst und die Frontend-Anzeige bleiben unverändert. Wir ersetzen nur den **Auslöser**: Cloudflare's eigener Worker-Cron triggert alle 5 min den GitHub `workflow_dispatch` — das läuft pünktlich.

## Änderungen

### 1. `wrangler.jsonc` — Cron-Trigger registrieren
Neue `triggers.crons`-Sektion mit `"*/5 * * * *"`. Cloudflare ruft dann alle 5 min die `scheduled()`-Funktion des Workers auf.

### 2. `src/server.ts` — `scheduled` Handler exportieren
Neben dem bestehenden `fetch` einen `scheduled(event, env, ctx)` Export hinzufügen, der die GitHub-Dispatch-Logik direkt ausführt (kein HTTP-Hop nötig). Nutzt `ctx.waitUntil(...)` damit der Worker auf den fetch-Aufruf wartet.

### 3. Logik in `src/lib/radar-dispatch.server.ts` auslagern
Die GitHub-`workflow_dispatch`-Logik aus `ingest-trigger.ts` (lines ~75-100) in eine wiederverwendbare Funktion `dispatchRadarIngest()` ausziehen. Verwendet `process.env.GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`, `GITHUB_REF`. Throttle (60s) bleibt drin.

### 4. `src/routes/api/public/radar/ingest-trigger.ts` — bleibt als Fallback
Endpoint bleibt erhalten (ruft jetzt `dispatchRadarIngest()` auf), damit man bei Bedarf manuell per curl/cron-job.org triggern kann. Throttle und Secret-Check unverändert.

### 5. GitHub Workflow `radar-ingest.yml`
Den `schedule:`-Trigger entfernen (oder als Backup mit längerem Intervall belassen, z. B. alle 30 min). `workflow_dispatch:` bleibt — das ist was Cloudflare jetzt aufruft.

## Was unverändert bleibt
- HDF5 → PNG Konvertierung, R2-Upload, Frontend-Animation, Farbskala, alle Karten
- Open-Meteo Vorhersage-Pipeline
- Embed-Seiten

## Technische Details

**`wrangler.jsonc`:**
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts",
  "triggers": { "crons": ["*/5 * * * *"] }
}
```

**`src/server.ts` (Ergänzung):**
```ts
export default {
  async fetch(request, env, ctx) { /* unverändert */ },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const { dispatchRadarIngest } = await import("./lib/radar-dispatch.server");
        try { await dispatchRadarIngest(); }
        catch (e) { console.error("[cron] radar dispatch failed:", e); }
      })()
    );
  },
};
```

**Env-Vars (bereits vorhanden):** `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`, `GITHUB_REF`. `RADAR_TRIGGER_SECRET` wird nur noch vom HTTP-Endpoint geprüft.

## Risiken / Hinweise
- Cloudflare Cron Triggers müssen beim Lovable-Deploy aus `wrangler.jsonc` übernommen werden. Falls der Deploy die `triggers`-Sektion ignoriert, fallen wir auf cron-job.org → bestehender HTTP-Endpoint zurück (Option C).
- Min. Intervall bei Cloudflare Workers Cron: 1 min. `*/5` ist sicher.
- Erste 1–2 Triggers nach Deploy verifizieren (Worker-Logs).
