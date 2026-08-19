# Hinweistext in der Lokalprognose anpassen

## Ziel

Der Platzhalter-Hinweis, der erscheint solange kein Ort gewählt ist, soll lauten:

„Gemeinde suchen oder „Ortung“ verwenden, um die 7-Tage-Prognose anzuzeigen.“

## Änderung

In `src/components/weather-widget.tsx` im Block für „kein Ort gewählt“ (Zeilen 423–438):

- Volle Variante: zweite Zeile von „um die 5-Tage-Prognose anzuzeigen.“ auf „um die 7-Tage-Prognose anzuzeigen.“ ändern; erste Zeile bleibt „Gemeinde suchen oder „Ortung“ verwenden,“ (typografische Anführungszeichen einheitlich).
- Kompakte/Embed-Variante: Text auf denselben Wortlaut vereinheitlichen — „Gemeinde suchen oder „Ortung“ verwenden, um die 7-Tage-Prognose anzuzeigen.“

Keine Logik-, Daten- oder Layoutänderungen.

## Prüfung

`/karten/lokal` ohne gewählten Ort öffnen und den Text prüfen; ebenso das Lokalprognose-Embed.
