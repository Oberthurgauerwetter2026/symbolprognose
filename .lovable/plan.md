## Ziel
GitHub-Action-Deploy von `cron-worker/` schlägt fehl, weil Wrangler den Cloudflare-Account nicht eindeutig auflösen kann. Fix: Account ID hardcoden.

## Änderung

**`cron-worker/wrangler.toml`** — direkt unter `name`-Zeile ergänzen:

```toml
account_id = "7399d9323a9b244c0e4f5352c9cd8ead"
```

Endresultat:

```toml
name = "symbolprognose-radar-cron"
account_id = "7399d9323a9b244c0e4f5352c9cd8ead"
main = "src/index.ts"
compatibility_date = "2025-09-24"
...
```

## Was danach passiert

1. Commit auf `main` → GitHub-Action "Deploy cron-worker" läuft automatisch.
2. Erwartung im Log: `Successfully deployed`.
3. Innerhalb 5 Min: erster `[cron:eps]`-Eintrag in den Cloudflare-Worker-Logs.

## Falls es trotzdem fehlschlägt

Dann ist es ein Token-Problem (falsche Permissions oder Tippfehler beim Einfügen ins GitHub-Secret). In dem Fall: Zeile aus `🚀 Running Wrangler Commands` im Action-Log posten.

## Nicht im Plan
- Keine Code-Änderung am Worker
- Kein Anfassen des Workflows
- Keine neuen Secrets
