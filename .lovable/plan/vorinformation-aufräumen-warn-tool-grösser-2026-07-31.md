# Vorinformation aufräumen + Warn-Tool grösser

## Teil 1 – Vorinformation sauber machen

Aktuell wird eine Vorinformation an mehreren Stellen wie eine echte Warnung behandelt:

- Das Gefahren-Banner und die Filter-Chips über der Warnkarte rechnen Vorinformationen in die Stufenfarbe ein (`levelByHazard`), obwohl die Fläche nur schraffiert ist.
- Im Info-Panel steht bei einer Vorinformation dasselbe wie bei einer Warnung — keine Kennzeichnung.
- Im Admin-Tool gibt es keine Möglichkeit, eine bestehende Meldung schnell zwischen Warnung und Vorinformation umzuschalten; nur über „Bearbeiten → Häkchen → Speichern".
- Die Buttons „Aktivieren/Deaktivieren" und „Löschen" in der Liste zeigen keinen Zustand und keine Fehlermeldung — schlägt der Aufruf fehl, passiert scheinbar nichts.
- Titel/Text aus der Vorlage lauten auch bei Vorinformation „…warnung (Stufe x)".

Umsetzung:

- Banner/Chips über der Karte unterscheiden Warnung und Vorinformation; Vorinformationen erzeugen kein Warn-Banner in Volltonfarbe, sondern die schraffierte Variante.
- Im Info-Panel erhält jede Vorinformation ein klar lesbares Kennzeichen „Vorinformation" (schraffierter Chip in Stufenfarbe).
- Admin-Liste: neuer Schnellschalter „→ Vorinformation" / „→ Warnung" pro Eintrag, dazu Ladezustand (Spinner) und sichtbare Fehlermeldung bei allen Listenaktionen.
- Beim Wechsel auf „Warnung" (advisory aus) wird — wenn die Meldung aktiv ist — der Push ausgelöst; beim Wechsel auf Vorinformation nie.
- Vorlagentexte: bei aktivem Häkchen „Vorinformation" heisst der Titel „Vorinformation: <Gefahr> (Stufe x)" und der Text bleibt sachlich (keine Warn-Formulierung); das Häkchen aktualisiert die Texte wie Gefahr/Stufe, solange sie nicht manuell verändert wurden.

## Teil 2 – Tool grösser und besser bedienbar

Das Admin-Tool nutzt durchgehend `text-xs` / `text-[10px]` und schmale Eingaben.

- Container von `max-w-5xl` auf `max-w-7xl`, mehr Innenabstand.
- Grundschrift auf `text-sm`/`text-base`, Labels `text-sm`, Überschriften eine Stufe grösser.
- Eingabefelder, Textareas, Datumsfelder und Buttons mit grösserer Höhe (`py-2.5`, `text-base`), Checkboxen auf `h-5 w-5` mit grösserer Klickfläche.
- Gemeinde-/Gefahren-/Stufen-Buttons grösser und mit mehr Abstand.
- Listeneinträge: Titel `text-sm/base`, Beschreibung `text-sm`, Badges `text-xs`, Aktionsbuttons als richtige Buttons statt Mini-Links.

## Technisch

- `src/routes/admin-warnungen.tsx`: Typografie/Spacing, Schnellschalter, Busy/Fehler-State, Vorlagen-Trigger auf `advisory`.
- `src/lib/warnings.functions.ts`: neue Server-Funktion `setWarningAdvisory` (Passwort-geschützt, setzt `advisory`, löst bei Wechsel auf Warnung + aktiv den Push aus).
- `src/lib/warnings-config.ts`: Titel-/Textvariante für Vorinformation.
- `src/components/maps/warn-map.tsx`: `levelByHazard` trennt advisory, Panel-Kennzeichen für Vorinformation.
- Keine Datenbankänderung nötig (`advisory` existiert bereits).
