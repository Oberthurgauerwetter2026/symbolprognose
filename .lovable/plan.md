Der Cron feuert alle 5 Min korrekt (`*/5 * * * *`-Events im Log). Es scheitern aber **beide Pings**:

## Diagnose

**1. Radar → HTTP 401 `Unauthorized`**
Der Endpoint vergleicht `x-trigger-secret`-Header gegen `RADAR_TRIGGER_SECRET` in Lovable Cloud. Beide Werte werden gelesen, aber sie stimmen nicht überein. Ursache: der Wert, den du via `wrangler secret put RADAR_TRIGGER_SECRET` im Cloudflare-Worker hinterlegt hast, ist nicht byte-identisch mit dem `RADAR_TRIGGER_SECRET` in Lovable Cloud (Tippfehler, zusätzliches Leerzeichen/Newline, oder unterschiedlicher Wert).

**2. EPS → HTTP 404, Body ist HTML (`<!DOCTYPE html>…`)**
Die Route `/api/public/eps/ingest-trigger.ts` existiert im Code, aber die **published** Version auf `symbolprognose.lovable.app` kennt sie nicht – darum liefert der Server den SPA-HTML-Fallback (= 404 für die Route). Das heisst: seit Hinzufügen des EPS-Endpoints wurde noch kein neuer Publish-Build deployed.

## Was du tun musst (kein Code-Change nötig)

**Schritt A – Radar-Secret synchron ziehen**

In Lovable Cloud (Backend → Secrets) den exakten Wert von `RADAR_TRIGGER_SECRET` kopieren. Dann im Cloudflare-Worker-Verzeichnis lokal:

```bash
cd cron-worker
wrangler secret put RADAR_TRIGGER_SECRET
# Wert exakt einfügen – keine Anführungszeichen, kein Leerzeichen, kein Newline
```

Tipp: am sichersten neu generieren — einen frischen Zufalls-String in Lovable Cloud setzen UND mit `wrangler secret put` im Worker setzen. Damit ist sichergestellt, dass beide identisch sind.

**Schritt B – Aktuelle Version publishen**

Damit `/api/public/eps/ingest-trigger` live geht: in Lovable oben rechts auf **Publish** klicken. Danach liefert die Route 202/429 statt 404-HTML.

## Verifikation

Nach beiden Schritten ~5 Min warten und Cloudflare → Observability/Logs nochmals prüfen. Erwartet:

- `[cron:radar] … → 202 dispatched: …` (oder 429 bei Throttle innerhalb 60 s)
- `[cron:eps] … → 202 dispatched: …` (oder 429 innerhalb 10 min)

Wenn nach Publish + Secret-Sync immer noch 401/404 kommen, melde dich mit dem neuen Log-Auszug.
