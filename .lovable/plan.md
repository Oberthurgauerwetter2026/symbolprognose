## Schritt-für-Schritt-Checkliste

Wir prüfen drei Bereiche: **GitHub Repo & Secrets**, **Lovable Cloud Secrets**, **Cloudflare R2**.

### A) Lovable Cloud Secrets (kann ich sehen)

Aktuell hinterlegt in Lovable:
- `LOVABLE_API_KEY` (managed, OK)
- `R2_PUBLIC_URL` (OK)

App braucht **nur `R2_PUBLIC_URL`** → 

Bitte du einmal kontrollieren:
1. Wert von `R2_PUBLIC_URL` in Lovable = öffentliche R2-Bucket-Basis-URL **ohne** `/radar/frames.json` am Ende, z.B. `https://pub-xxxxx.r2.dev` oder `https://radar.deinedomain.tld`.
2. Beim Aufruf von `<R2_PUBLIC_URL>/radar/frames.json` im Browser muss eine JSON-Datei erscheinen (oder 404, wenn noch nie hochgeladen).

### B) GitHub Repo `symbolprognose`

Bitte einmal prüfen und mir bestätigen:

1. **Workflow-Datei vorhanden**: `.github/workflows/radar-ingest.yml` liegt auf `main` (Default-Branch).
2. **Actions aktiviert**: Repo → Tab **Actions** → "Radar Ingest" sichtbar.
3. **Letzter Run-Status**: Repo → Actions → "Radar Ingest" → letzter Run. Erwartet: grün ✓. Falls rot → vollständigen Log schicken.
4. **Secrets gesetzt**: Repo → Settings → Secrets and variables → **Actions** → **Repository secrets**. Es müssen exakt diese 5 Einträge existieren:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_URL` (gleicher Wert wie in Lovable)
   
   Bitte die Namen 1:1 kontrollieren (Tippfehler, Großschreibung).
5. **Manueller Testlauf**: Actions → "Radar Ingest" → "Run workflow" auf `main` triggern. Volle Logausgabe danach hierher kopieren.

### C) Altes Repo `symbolprognose-radar`

Falls noch vorhanden:
- Sein Workflow muss **deaktiviert** sein (Actions-Tab → Workflow → "···" → Disable), sonst überschreibt er periodisch `radar/frames.json` mit veralteten Daten.

### D) Cloudflare R2

Im Cloudflare Dashboard → R2 → Bucket prüfen:
1. Bucket-Name = exakt Wert von `R2_BUCKET`.
2. **Public Access** aktiviert (entweder `r2.dev`-URL freigeschaltet oder Custom Domain).
3. Im Bucket existieren nach erfolgreichem Lauf:
   - Ordner `radar/precip/` mit `.png`-Dateien
   - Ordner `radar/hail/` mit `.png`-Dateien
   - Datei `radar/frames.json`
4. `R2_PUBLIC_URL/radar/frames.json` im Browser liefert JSON mit `frames: [...]`.

### Ablauf

Du gehst Punkt für Punkt durch und meldest Stand. Sobald wir einen Fehler finden, fixen wir ihn gezielt. Am wichtigsten ist Schritt **B5 (manueller Run + voller Log)** — damit zeigt unser neues Diagnose-Logging eindeutig, woran es scheitert (STAC, Parsing, R2-Upload oder Manifest).