## Ziel

GitHub-Action, die `cron-worker/` automatisch zu Cloudflare deployed, sobald sich dort etwas ändert (oder manuell per "Run workflow"-Button). Damit muss der User nie selbst `wrangler` ausführen.

## Was ich anlege

**`.github/workflows/cron-worker-deploy.yml`** — Workflow mit:

- Trigger:
  - `push` auf `main`, gefiltert auf `cron-worker/**` und die Workflow-Datei selbst
  - `workflow_dispatch` (manueller Knopf in GitHub Actions UI)
- Steps:
  1. `actions/checkout@v4`
  2. `oven-sh/setup-bun@v2` (für `bun install` im `cron-worker/`-Ordner)
  3. `bun install` im `cron-worker/`
  4. `cloudflare/wrangler-action@v3` mit `workingDirectory: cron-worker` und dem API-Token aus `secrets.CLOUDFLARE_API_TOKEN`
- Concurrency-Gruppe `cron-worker-deploy`, damit parallele Pushes sich nicht ins Gehege kommen

**`cron-worker/package.json`** — falls noch keine `wrangler`-devDependency drin steht, ergänzen, damit der CI-Lauf reproduzierbar ist. (Ich prüfe das beim Implementieren.)

## Was der User danach einmalig tun muss

Das kann ich nicht für ihn machen — nur er hat Zugriff auf Cloudflare + GitHub-Repo-Settings:

1. **Cloudflare-API-Token erstellen**
   - cloudflare.com → My Profile → API Tokens → Create Token → Template "Edit Cloudflare Workers"
   - Account auswählen, Token erstellen, Wert kopieren
2. **Token in GitHub als Secret hinterlegen**
   - GitHub-Repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `CLOUDFLARE_API_TOKEN`, Value: der kopierte Token
3. **Workflow manuell einmal anstossen**
   - GitHub-Repo → Actions → "Deploy cron-worker" → Run workflow
   - Damit wird die aktuelle Version (mit EPS-Trigger) auf Cloudflare scharf geschaltet
   - Ab dann passiert das automatisch bei jeder Änderung in `cron-worker/`

## Verifikation nach Deploy

- GitHub-Action-Log zeigt "Successfully deployed"
- Cloudflare-Dashboard → Workers → `symbolprognose-radar-cron` → Logs zeigen innerhalb 5 Min einen `[cron:eps]`-Eintrag
- Nach ~10 Min: `eps/latest.json` in R2 hat ein frisches `generatedAt`

## Nicht im Plan

- Keine Änderung am Worker-Code selbst (ist schon korrekt)
- Keine Änderung an den Lovable-Cloud-Secrets (alle nötigen Werte existieren bereits)
- Kein Anfassen des Radar-Ingest-Pfads
