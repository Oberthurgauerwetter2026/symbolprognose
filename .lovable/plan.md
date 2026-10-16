# GitHub-Hinweis „Workflow will be disabled soon“

## Was der Hinweis bedeutet
GitHub schaltet Workflows mit Zeitplan (`schedule:`) ab, wenn im Repository 60 Tage lang kein neuer Commit kommt. Bei diesem Projekt betrifft das nur „Deploy cron-worker“ (der tägliche Sicherheits-Deploy um 03:10 UTC). Radar, Blitze, Open-Meteo, AROME, MCH und Symbol werden vom Cron-Worker angestossen, nicht von GitHub-Zeitplänen. Diese laufen also weiter.

## Was du jetzt tun musst (1 Klick)
1. GitHub → Repository → Tab **Actions** öffnen.
2. Den Workflow mit dem gelben Hinweis anklicken („Deploy cron-worker“).
3. Auf **„Continue running workflow“** (bzw. „Enable workflow“) klicken.

Damit startet die 60-Tage-Frist neu. Jede Änderung, die ich hier im Projekt mache, erzeugt ebenfalls einen Commit und setzt die Frist zurück.

## Optional – damit der Hinweis nie wieder kommt
Ich kann einen kleinen Keepalive-Schritt in `cron-worker-deploy.yml` einbauen (z. B. `gautamkrishnar/keepalive-workflow`). Er hält den Workflow über die API aktiv, ohne Commits zu erzeugen. Dafür braucht der Workflow die Berechtigung `actions: write`. Sonst ändert sich nichts.

Wenn du nur Schritt 1–3 machen willst, musst du hier nichts genehmigen.
