# SMS-Warnmeldungen als zusätzlicher Kanal (Twilio)

## Zusammenfassung

Neben Web-Push wird ein SMS-Abonnement angeboten. Nutzer geben auf der Warnkarte-Seite ihre Mobilnummer an, wählen Gemeinden und erhalten bei echten Warnungen (Stufe 1–3) eine SMS. Web-Push bleibt unverändert bestehen.

## Alternative Kanäle (kurz erwähnt)

- **WhatsApp**: Möglich über Twilio oder WhatsApp Business, aber nur mit verifizierter Business-Nummer und Meta-Genehmigung. Aufwand deutlich höher als SMS.
- **E-Mail**: Einfach über Brevo oder Lovable Emails umsetzbar, geeignet für weniger zeitkritische Hinweise.
- **Telegram-Bot**: Nutzer müssen selbst einen Bot abonnieren, akzeptiert aber keine SMS-Handynummern.

Dieser Plan konzentriert sich auf **SMS via Twilio**, weil es der schnellste, breitest nutzbare und kostengünstigste Weg ist.

## Geplante Änderungen

### 1. Twilio-Connector verbinden

- `standard_connectors--connect` mit `connector_id: twilio` aufrufen.
- Der Connector stellt `TWILIO_API_KEY` sowie `LOVABLE_API_KEY` als Server-Secrets bereit.
- Im Twilio-Dashboard: SMS Geo Permissions auf Schweiz/EU beschränken und SMS Pumping Protection aktivieren, um Betrug zu vermeiden.
- Absendernummer (Twilio-Handynummer) in den Server-Secrets oder im Code als nicht-geheime Konfiguration hinterlegen.

### 2. Datenbank: SMS-Abos

Neue Tabelle `public.sms_subscriptions`:

```text
id                uuid primary key default gen_random_uuid()
phone             text not null  -- E.164, z.B. +41791234567
region_ids        text[] not null default '{}'
confirmed         boolean not null default false
confirmation_code text
created_at        timestamptz default now()
updated_at        timestamptz default now()
```

Dazu GRANTs (nur `service_role` für Schreibzugriff, `anon`/`authenticated` bekommen keinen direkten Zugriff), RLS aktivieren und ein Trigger für `updated_at`.

### 3. Server-Funktionen

- `saveSmsSubscription`: Handynummer normalisieren/validieren, Bestätigungscode generieren, per Twilio-SMS zuschicken, Datensatz als `confirmed = false` speichern.
- `confirmSmsSubscription`: Code prüfen, `confirmed = true` setzen.
- `removeSmsSubscription`: Abo anhand der Handynummer löschen (ggf. mit erneuter Code-Bestätigung, um Missbrauch zu verhindern).
- `notifySmsWarning`: wird bei `notifyWarning` oder unmittelbar nach dem Speichern einer Warnung aufgerufen. Sucht alle `confirmed = true` SMS-Abos mit überlappenden `region_ids` und versendet per Twilio-Gateway eine kurze SMS.

SMS-Textvorlage (ähnlich Push):

```text
⚡️ Gewitterwarnung (Stufe 3) für Amriswil, Romanshorn +3 – gültig bis 18:00. Details: oberthurgauerwetter.ch
```

### 4. UI auf der Warnkarte

In `src/routes/warnkarte.tsx` bzw. in der bestehenden Push-Opt-In-Komponente (`src/components/warnings/push-opt-in.tsx`) einen zweiten Reiter/Block ergänzen:

- Eingabefeld für Handynummer (CH-Nummern automatisch mit +41 normalisieren).
- Dieselbe Gemeinde-Auswahl wie bei Web-Push.
- Button „SMS-Code anfordern“ → Code per SMS erhalten.
- Eingabefeld für 6-stelligen Code → „Abo bestätigen“.
- Hinweis auf Kosten/Nutzung und Datenschutz.

### 5. Sicherheit & Missbrauchsschutz

- Handynummern serverseitig mit Zod validieren (E.164-Regex, max. 20 Zeichen).
- Rate-Limit: pro Nummer max. 3 Code-Versuche pro Stunde, global max. 30 SMS/Minute.
- Keine Logging der Handynummern in Konsole oder unverschlüsselt.
- Löschung auf Nutzerwunsch ermöglichen.
- Twilio-Sicherheitsfunktionen aktivieren (Geo Permissions, SMS Pumping Protection).

### 6. Cron / Versandzeitpunkt

SMS werden an denselben Hook gehängt, der auch Web-Push auslöst: nach dem Speichern/Aktivieren einer Warnung sowie bei der automatischen Gewitterwarnung. Vorinformationen (`advisory = true`) werden nicht per SMS versendet.

## Technische Details

- Twilio-Gateway-Base: `https://connector-gateway.lovable.dev/twilio`
- Authentifizierung: `Authorization: Bearer ${LOVABLE_API_KEY}` und `X-Connection-Api-Key: ${TWILIO_API_KEY}`
- Twilio-Endpunkt: `POST /Messages.json` mit `URLSearchParams` (Form-Encoded)
- Parameter: `To`, `From` (Twilio-Sendernummer), `Body`

## Kostenhinweis

- Twilio berechnet pro versendeter SMS (und ggf. pro empfangener Antwort).
- Bei vielen Abonnenten können Kosten bei jeder Warnung entstehen. Daher ist die Geo-Permission- und Pumping-Protection-Empfehlung wichtig.

## Nicht im Scope

- Keine SMS-Versendung für Vorinformationen (`advisory = true`).
- Kein Ersatz für Web-Push; Web-Push bleibt primärer Kanal.
- Keine WhatsApp- oder E-Mail-Integration in diesem Plan.
