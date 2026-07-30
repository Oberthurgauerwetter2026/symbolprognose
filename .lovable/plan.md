Entferne den Footer-Link "Oberthurgauer Wetter – zur Hauptseite" auf der Standalone-Warnkarte (`/warnkarte`), damit die PWA-Seite keine Abzweigung zur Hauptseite mehr zeigt.

## Änderung
- Datei: `src/routes/warnkarte.tsx`
- Entferne das `<footer>`-Element mit dem Link zur Hauptseite.
- Entferne den ungenutzten `Link`-Import aus `@tanstack/react-router`, falls danach keine weiteren `Link`-Verwendungen in der Datei vorhanden sind.

## Warum
Der Footer-Link stört das Standalone-Erlebnis der Warnkarte als PWA/Home-Screen-App. Die Seite soll ausschliesslich die Warnkarte und das Abo-Panel zeigen, ohne Abzweigung zur Hauptseite.

## Keine weiteren Anpassungen
Alle anderen Metadaten, Manifest-Logik und die `WarnMap`-Komponente bleiben unverändert.