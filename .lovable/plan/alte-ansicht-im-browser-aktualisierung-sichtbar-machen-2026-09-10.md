# Alte Ansicht im Browser: Aktualisierung sichtbar machen

## Ausgangslage
Die neuen Hilfestellungen (Anleitung für dein Gerät, Übersicht „Wo funktionieren Warn-Meldungen?“) sind im Projekt vorhanden und im Vorschaufenster sichtbar. In den Browsern erscheint noch die alte Fassung, weil der aktuelle Stand noch nicht veröffentlicht wurde.

## Vorgehen
1. Die App veröffentlichen, damit die öffentliche Warnkarte den neuen Stand erhält.
2. Prüfen, dass die veröffentlichte Warnkarte die Hilfestellungen zeigt (auch im Vorschaufenster-Fall und auf iPhone).
3. Damit gespeicherte Home-Bildschirm-Apps und Browser nicht an einer alten Fassung hängen bleiben: die Seite so ausliefern, dass die HTML-Seite nicht zwischengespeichert wird, und den vorhandenen Push-Dienst so anpassen, dass er sich bei einer neuen Version sofort aktualisiert.
4. Kurze Anleitung für dich: einmal neu laden (auf dem iPhone die gespeicherte App schliessen und neu öffnen), damit die neue Fassung sicher erscheint.

## Technisch
- Veröffentlichen des aktuellen Stands; danach Kontrolle der ausgelieferten `/warnkarte`.
- `public/push-sw.js`: `skipWaiting`/`clients.claim` bleiben, zusätzlich Versionskennung, damit iOS-Web-Apps den Worker sicher erneuern.
- Für die Warnkarten-Route bzw. den Manifest-Endpunkt kurze bzw. `no-cache`-Header prüfen, damit Browser die HTML-Seite nicht länger vorhalten.
- Keine Änderungen an Datenbank, Push-Versand oder Warnlogik.
