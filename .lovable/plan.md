# Warn-Tool: Passwort dauerhaft merken

Das Warn-Tool fragt heute bei jedem neuen Browser-Tab bzw. nach dem Schliessen des Browsers wieder nach dem Passwort, weil es nur für die Sitzung gespeichert wird. Künftig gibst du es einmal ein und bleibst auf diesem Gerät angemeldet.

## Verhalten neu

- Nach erfolgreichem Entsperren wird das Passwort dauerhaft im Browser gespeichert (nicht nur für die Sitzung). Beim nächsten Öffnen von `/admin-warnungen` erscheint direkt das Tool.
- Ein bereits gespeichertes Passwort wird beim Öffnen automatisch serverseitig geprüft. Stimmt es nicht mehr (z. B. Passwort geändert), wird es verworfen und der Login erscheint erneut.
- Der bestehende „Abmelden“-Button löscht die Speicherung weiterhin, damit du dich auf fremden Geräten wieder abmelden kannst.
- Der Passwortschutz selbst bleibt vollständig erhalten – serverseitig prüft jede Warn-Funktion weiter das Passwort.

## Technische Umsetzung

- `src/routes/admin-warnungen.tsx`: in `WarnAdminPage` `sessionStorage` durch `localStorage` ersetzen (Lesen beim Mount, Schreiben nach Login, Löschen beim Logout).
- Beim Mount das gespeicherte Passwort per `checkAdminLogin` validieren; bei `ok: false` Eintrag entfernen und Login-Formular zeigen. Kurzer Ladezustand, solange die Prüfung läuft.
- Migration: ein noch in `sessionStorage` liegender Eintrag wird beim ersten Laden übernommen und dort entfernt.
- Keine Änderungen an Server-Funktionen oder an `WARN_ADMIN_PASSWORD`.
