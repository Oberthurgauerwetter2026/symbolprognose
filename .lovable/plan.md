## Ausgangslage (geprüft)

- `/admin-warnungen` prüft das Passwort serverseitig gegen den Geheimwert `WARN_ADMIN_PASSWORD` (`src/lib/warnings.server.ts:101`, Server-Funktion `checkAdminLogin`).
- `/admin` hat das Passwort noch fest im Frontend-Code stehen: `const ADMIN_PASSWORD = "wetter2026"` (`src/routes/admin.tsx:7`). Es ist damit erstens veraltet und zweitens für jeden im Browser lesbar.

## Ziel

Beide Admin-Bereiche nutzen dasselbe, im Backend hinterlegte Passwort. Es gibt nur noch eine Stelle, an der es geändert werden muss.

## Umsetzung

1. `src/routes/admin.tsx`
   - Hartkodiertes Passwort und den lokalen Vergleich entfernen.
   - Login-Formular ruft die bestehende Server-Funktion `checkAdminLogin` auf (aus `src/lib/warnings.functions.ts`) und entsperrt nur bei `ok: true`.
   - Ladezustand am Button („Prüfen …“) und Fehlermeldung „Falsches Passwort.“ beibehalten.
   - Entsperr-Merker bleibt wie bisher in `sessionStorage` (`wx_admin_unlocked`), damit ein Reload nicht ausloggt; Abmelden löscht ihn.

2. Keine Änderungen an `/admin-warnungen`, an der Datenbank oder am Geheimwert nötig – dort läuft die Prüfung bereits über `WARN_ADMIN_PASSWORD`.

## Hinweis

Das aktuell gültige Passwort ist das, das zuletzt für `WARN_ADMIN_PASSWORD` gesetzt wurde. Falls du es neu setzen willst, kann ich dafür das sichere Eingabeformular öffnen – danach gilt es automatisch für beide Seiten.

## Technische Details

- `useServerFn(checkAdminLogin)` im Login-Handler, `await` mit `{ data: { password: pw } }`, Fehler abfangen und als generische Meldung anzeigen (keine Server-Details ins UI).
- `/admin` bleibt eine reine Info-Seite (Modelle, MOSMIX-Zuordnung, Embed-Snippet), enthält also keine geheimen Inhalte; das Gate ist weiterhin nur ein einfacher Zugangsschutz, keine echte Benutzerverwaltung.
