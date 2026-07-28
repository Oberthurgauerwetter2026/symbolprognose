## Ziel

`warnkarte.oberthurgauerwetter.ch` zeigt auf die Lovable-App. Die WordPress-Seite bettet die Warnkarte per Iframe ein; für Benachrichtigungen öffnen Nutzer die Subdomain in einem eigenen Tab.

## Teil A – Was du bei Cyon machst

Im Cyon-DNS-Editor für `oberthurgauerwetter.ch`:

1. **Keine Subdomain** über das Formular aus deinem Screenshot anlegen (das erzeugt Webhosting auf Cyon und blockiert uns). Falls `warnkarte` dort schon existiert: löschen.
2. Im **DNS-Editor** zwei Einträge anlegen:

```text
Typ   Name        Wert
A     warnkarte   185.158.133.1
TXT   _lovable    lovable_verify=…  (exakter Wert kommt aus Lovable)
```

3. Prüfen, dass für `warnkarte` **kein weiterer** A-, CNAME- oder Weiterleitungs-Eintrag existiert.

## Teil B – Was du in Lovable machst

1. **Project Settings → Project → Domains → Connect Domain**
2. `warnkarte.oberthurgauerwetter.ch` eingeben → Lovable zeigt den TXT-Wert an
3. TXT-Wert bei Cyon eintragen, Status abwarten: Verifying → Setting up → **Active**
4. Danach **Publish/Update** klicken

## Teil C – Code-Anpassungen (mache ich)

Der Grossteil ist bereits vorbereitet (`src/lib/site-url.ts`, Metadaten, Embed-Route). Offen sind zwei Robustheits-Punkte:

1. **`public/manifest.webmanifest`**: `start_url` und `scope` von absoluten URLs auf relative Pfade (`/karten/warnungen`, `/`) umstellen. Absolute URLs brechen die PWA-Installation, solange die App noch unter `symbolprognose.lovable.app` läuft, und sind nach dem Domain-Wechsel unnötig.
2. **`src/lib/site-url.ts`**: `getAppUrl` so anpassen, dass im Iframe nur dann auf `SITE_URL` gewechselt wird, wenn die Domain erreichbar ist – konkret: die Ziel-Domain bleibt fest verdrahtet, aber im Preview/Nicht-Produktions-Kontext wird die aktuelle Origin genutzt, damit du vor dem Domain-Go-Live testen kannst.

## Teil D – WordPress-Einbindung

Nach Domain-Aktivierung nutzt du dieses Snippet (steht schon auf `/embed-info`, ich prüfe die URL darin):

```html
<iframe src="https://warnkarte.oberthurgauerwetter.ch/embed/warnungen"
        style="width:100%;height:760px;border:0" loading="lazy"></iframe>
```

Im Iframe erscheint der Button „Warnungen abonnieren – in eigenem Tab öffnen", der auf die Subdomain führt. Dort funktionieren Push-Benachrichtigungen, weil der Service Worker an diese Origin gebunden ist.

## Technische Notiz

Push im Iframe wird von allen Browsern blockiert (Permissions Policy + Third-Party-Storage). Deshalb ist der Tab-Wechsel keine Notlösung, sondern der einzige funktionierende Weg. Auf iOS muss der Nutzer die Seite zusätzlich über „Zum Home-Bildschirm" installieren, bevor Push verfügbar ist.
