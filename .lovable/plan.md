## Problem

Die GitHub-Action `cloudflare/wrangler-action@v3` deployt nicht den Cron-Worker, sondern versucht das Hauptprojekt zu bundeln (`src/server.ts`, `error-capture.ts` …). Ursache: Im Repo-Root liegt eine `wrangler.jsonc` (`name: "tanstack-start-app"`, `main: "src/server.ts"`). Wrangler v3 sucht beim Deploy nach Config — und bevorzugt in diesem Setup die Root-`wrangler.jsonc` über die `cron-worker/wrangler.toml`, obwohl `workingDirectory: cron-worker` gesetzt ist. Ergebnis: `Could not resolve "@tanstack/react-start/server-entry"` → Action rot.

## Fix

Den Wrangler-Aufruf explizit an `cron-worker/wrangler.toml` binden, damit die Root-`wrangler.jsonc` ignoriert wird.

**Datei:** `.github/workflows/cron-worker-deploy.yml`

Im Step "Deploy to Cloudflare" einen `command`-Input ergänzen:

```yaml
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          workingDirectory: cron-worker
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy --config wrangler.toml
```

Damit ruft die Action `wrangler deploy --config wrangler.toml` im Ordner `cron-worker` auf — Wrangler kann nicht mehr in den Root-Ordner hochklettern und nimmt garantiert die richtige Config (`name: symbolprognose-radar-cron`, `main: src/index.ts`).

## Verifikation

Nach Commit auf `main`:
1. GitHub → Actions → "Deploy cron-worker" → letzter Run grün, Log zeigt `Uploaded symbolprognose-radar-cron`.
2. Cloudflare Dashboard → Workers & Pages → `symbolprognose-radar-cron` → Live-Logs zeigen innerhalb 5 Min `[cron:radar] … → 202` und `[cron:eps] … → 202`.

Keine weiteren Änderungen am Cron-Worker-Code oder am Hauptprojekt nötig.