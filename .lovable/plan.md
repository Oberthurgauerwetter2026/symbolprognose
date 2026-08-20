# GitHub-Token erneuern (läuft in 7 Tagen ab)

## Was die Mail bedeutet

Das ist eine normale Ablauf-Erinnerung von GitHub für den Zugriffstoken „Lovable Radar Trigger". Dieser Token erlaubt der App, die Ingest-Workflows (Radar, Open-Meteo, AROME, Blitze, MCH-Lokalprognose, Symbole) automatisch zu starten. Er hat nichts mit deinem Code, der Datenbank oder der Warnkarte zu tun.

Es muss **nichts neu gemacht werden**. Nur der Token selbst wird ersetzt — zwei Klicks bei GitHub und ein aktualisierter Wert in den App-Secrets.

Wenn nichts passiert: nach Ablauf schlagen die Ingest-Läufe mit „401 Bad credentials" fehl, das Radar/Prognosebilder frieren auf dem letzten Stand ein. Die Karten und Warnungen selbst bleiben bestehen, werden aber nicht mehr aktualisiert.

## Vorgehen

1. Du klickst in der Mail auf „Regenerate your token" (bzw. öffnest den Link) und bestätigst bei GitHub. Wichtig: die gleichen Rechte behalten (Repo-Zugriff mit „Actions: read and write"), Laufzeit z. B. 1 Jahr.
2. GitHub zeigt den neuen Token **einmal** an — kopieren.
3. Ich öffne dir ein sicheres Eingabefeld für das Secret `GITHUB_DISPATCH_TOKEN`; du fügst den neuen Wert dort ein. Der Wert läuft nicht über den Chat.
4. Ich prüfe danach im Warn-Tool bzw. per Test-Trigger, dass ein Ingest-Lauf wieder startet.

## Technische Details

- Verwendet in `src/lib/gh-dispatch.server.ts` (`githubDispatchEnv()` liest `process.env.GITHUB_DISPATCH_TOKEN`), genutzt von allen `*-dispatch.server.ts`-Modulen und den `/api/public/*/ingest-trigger`-Routen.
- Benötigte Feinrechte des Tokens: Repository-Zugriff auf das Projekt-Repo, Permission „Actions: Read and write" (für `workflow_dispatch` und Statusabfragen).
- Der Cron-Worker verwendet keinen eigenen GitHub-Token, er ruft nur die App-Endpunkte mit `x-trigger-secret` — dort ist keine Änderung nötig.
