## Situation

Das Passwort für `/admin-warnungen` liegt als geheimer Wert im Backend (`WARN_ADMIN_PASSWORD`) und kann nicht ausgelesen werden – auch nicht von mir. Es lässt sich aber jederzeit neu setzen.

## Vorgehen

1. Ich öffne das sichere Eingabefeld für `WARN_ADMIN_PASSWORD`; du trägst dort ein neues Passwort ein (nicht in den Chat schreiben).
2. Der neue Wert wird im Backend hinterlegt; die Passwortprüfung läuft weiterhin serverseitig, es sind keine Code-Änderungen nötig.
3. Danach prüfe ich den Login auf `/admin-warnungen` und melde, ob er funktioniert.

## Hinweis

Falls du willst, kann ich anschliessend auf der Admin-Seite einen kleinen Hinweis ergänzen, dass das Passwort im Backend änderbar ist – sonst bleibt alles unverändert.
