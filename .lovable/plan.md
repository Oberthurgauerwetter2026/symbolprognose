## Plan: R2-Anbindung fertigstellen

### Schritt 1 — R2 API Token in Cloudflare erstellen

1. Im Cloudflare-Dashboard: **R2 → Overview → "Manage R2 API Tokens"** (rechts oben)
2. **"Create API Token"** klicken
3. Einstellungen:
   - **Token name**: `symbolprognose-radar-rw`
   - **Permissions**: **Object Read & Write**
   - **Specify bucket**: nur `symbolprognose-radar` auswählen
   - **TTL**: Forever (oder nach Wunsch)
4. **"Create API Token"** klicken
5. Auf der folgenden Seite **kopieren** (werden nur einmal angezeigt!):
   - **Access Key ID**
   - **Secret Access Key**

### Schritt 2 — Secrets in Lovable Cloud eintragen

Ich öffne dir parallel den Secret-Dialog für alle 5 Werte:

| Secret | Wert |
|---|---|
| `R2_ACCOUNT_ID` | `7399d9323a9b244c0e4f5352c9cd8ead` |
| `R2_ACCESS_KEY_ID` | aus Schritt 1 |
| `R2_SECRET_ACCESS_KEY` | aus Schritt 1 |
| `R2_BUCKET` | `symbolprognose-radar` |
| `R2_PUBLIC_URL` | `https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev` |

### Schritt 3 — Dieselben 5 Secrets in GitHub eintragen

Falls die R2-Uploads über einen GitHub Actions Workflow laufen:
**GitHub Repo → Settings → Secrets and variables → Actions → New repository secret** — gleiche 5 Namen/Werte wie oben.

(Wenn die Uploads ausschließlich aus Lovable laufen, kann dieser Schritt entfallen — sag dann kurz Bescheid.)

### Schritt 4 — CORS-Policy am Bucket setzen

Im Bucket **Settings → CORS Policy → + Add**:

```json
[
  {
    "AllowedOrigins": ["https://symbolprognose.lovable.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Schritt 5 — Verifizierung

Nach Eintragen der Secrets:
- Teste, ob ein Upload auf den Bucket geht
- Teste, ob die Public-URL einen Beispielfile lädt

---

**Sag „implement", wenn ich loslegen soll** — ich starte dann mit dem Secret-Dialog für die 5 R2-Werte in Lovable.