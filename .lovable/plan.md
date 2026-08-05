Abo-Laufzeit

## Ist-Zustand
- `public.push_subscriptions` hat keine `expires_at`-Spalte.
- Ein Abo bleibt aktiv, bis der Nutzer im Browser „Benachrichtigungen ausschalten" wählt oder der Push-Endpunkt ungültig wird (404/410) – dann wird es automatisch gelöscht.
- `updated_at` wird bei jeder Änderung der Gemeindenauswahl aktualisiert.

## Entscheidung
Nutzer bestätigt: Abos sollen unbefristet aktiv bleiben.

## Massnahme
Keine Code- oder Datenbank-Änderung erforderlich. Das aktuelle Verhalten bleibt bestehen.
