# Abonnierte Gemeinden im Push-Bereich anzeigen und ändern

## Problem

Wer Benachrichtigungen aktiviert hat, sieht danach nur den Satz „Aktiv – du erhältst Warnmeldungen für deine gewählten Gemeinden“. Welche Gemeinden das konkret sind, ist nicht sichtbar – und nach dem Neuladen der Seite ist die Auswahl im Browser gar nicht mehr bekannt (sie liegt nur in der Datenbank).

## Was gebaut wird

1. **Abonnierte Gemeinden auflisten**
   Ist ein Abo aktiv, zeigt der Push-Bereich die abonnierten Gemeinden als Chips an, mit Zähler („Abonniert: 21 von 21 Gemeinden“) und dem Datum der letzten Änderung. Die Liste wird beim Öffnen der Karte anhand des vorhandenen Push-Endpoints vom Server geladen, funktioniert also auch nach Neustart des Geräts.

2. **Auswahl nachträglich ändern**
   Neuer Button „Gemeinden ändern“ öffnet die bekannte Auswahlliste, vorbelegt mit den bisher abonnierten Gemeinden. „Speichern“ aktualisiert das Abo (keine neue Push-Berechtigung nötig), „Abbrechen“ verwirft.

3. **Sonderfall abgelaufenes Abo**
   Findet der Server zum Endpoint keinen Eintrag mehr (z. B. gelöscht), erscheint der Hinweis, dass das Abo nicht mehr registriert ist, mit dem Aktivieren-Ablauf wie bisher.

## Technische Details

- `src/lib/warnings.functions.ts`: neue Server-Funktion `getPushSubscription({ endpoint })`, die über den Admin-Client `region_ids` und `updated_at` zum Endpoint liest und `{ found, regionIds, updatedAt }` zurückgibt. Endpoint wird wie beim Speichern validiert (nur `https://`, max. 1000 Zeichen); es werden keine Schlüssel (`p256dh`/`auth`) zurückgegeben.
- `src/components/warnings/push-opt-in.tsx`: nach dem Lesen der bestehenden `PushSubscription` wird `getPushSubscription` aufgerufen und `regionIds` gesetzt; neuer Zustand `editing` für den Änderungsmodus; Speichern nutzt das bestehende `savePushSubscription` (Upsert auf `endpoint`).
- Keine Schema- oder Policy-Änderung nötig: `push_subscriptions` bleibt per RLS gesperrt, der Zugriff läuft ausschliesslich über die Server-Funktion.
