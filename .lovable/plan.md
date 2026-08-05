# Abonnierte Gemeinden einklappbar anzeigen

## Verhalten neu

Im Push-Bereich der Warnkarte wird die Liste der abonnierten Gemeinden nicht mehr dauerhaft als Chip-Block angezeigt, sondern hinter einer aufklappbaren Zeile versteckt:

- Geschlossen (Standard): eine Zeile „Abonniert: 21 von 21 Gemeinden“ mit Pfeil-Symbol rechts. Das ist der ganze Platzbedarf.
- Aufgeklappt: darunter erscheinen die Gemeinde-Chips, das Datum „Zuletzt geändert: …“ und der Button „Gemeinden ändern“.
- Der Zustand hält, solange die Karte offen ist.

Der Sonderfall „Abo nicht mehr registriert“ bleibt unverändert als direkter Hinweistext (nicht einklappbar).

## Technische Details

- `src/components/warnings/push-opt-in.tsx`: neuer Zustand `const [subsOpen, setSubsOpen] = useState(false)`.
- Der Block ab „Abonniert: …“ (aktuell Zeilen 332–373) wird zu einem Button-Header mit `ChevronDown` (Rotation bei offen, gleiches Muster wie „Gemeinden wählen“) plus einem `subsOpen &&`-Zweig mit Chips, Zeitstempel und „Gemeinden ändern“-Button.
- Beim Klick auf „Gemeinden ändern“ bleibt die bestehende Logik (`setEditing(true)`, `setPickOpen(true)`).
- Keine Änderungen an Server-Funktionen, Datenbank oder Push-Logik.
