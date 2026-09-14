# Favoriten bleiben auch im WordPress-Fenster erhalten

## Was los ist

Auf der Website selbst funktionieren die Favoriten (im Test bestätigt: gesetzt, neu geladen, weiterhin vorhanden).

Im eingebauten Fenster auf WordPress ist es anders: Safari auf iPhone/iPad blockiert bei eingebetteten Fenstern von einer anderen Adresse den eigenen Browserspeicher bzw. leert ihn beim Neuladen. Deshalb ist die Favoritenliste dort nach dem Neuladen leer.

## Lösung

Die Favoriten werden künftig nicht im eingebetteten Fenster gespeichert, sondern in der WordPress-Seite selbst, in der das Fenster steckt. Das Fenster fragt die Seite nach den Favoriten und lässt sie dort ablegen.

Damit das funktioniert, muss das Einbettungs-Snippet auf WordPress einmal aktualisiert werden — das neue Snippet steht wie bisher auf der Snippet-Seite bereit (es ist derselbe kleine Zusatzcode, der schon die Höhe anpasst).

### Verhalten neu

- Website (oberthurgauer-wetter): unverändert, Favoriten wie bisher.
- WordPress-Fenster mit aktualisiertem Snippet: Favoriten werden gesetzt, überstehen Neuladen und gelten für alle Lokalprognose-Fenster derselben WordPress-Seite.
- WordPress-Fenster mit altem Snippet oder blockiertem Speicher: Favoriten funktionieren für die laufende Sitzung; erscheint der Stern-Bereich, steht ein kurzer Hinweis „In diesem Fenster nicht dauerhaft speicherbar — Karte in eigenem Tab öffnen“ mit Link.
- Kein Konto, keine Datenbank, keine Adressen oder persönlichen Daten werden gespeichert.

## Technische Umsetzung

- `src/lib/favorites.ts`: Speicherzugriff hinter eine kleine Speicher-Schicht legen.
  - Schreibtest beim Start (`setItem`/`getItem`/`removeItem` auf einen Testschlüssel). Erfolgreich → `localStorage` wie bisher.
  - Im iframe zusätzlich ein `postMessage`-Kanal zum Eltern-Fenster (`otw:fav:get` / `otw:fav:set`, Antwort `otw:fav:value`) mit Timeout ~1,5 s und In-Memory-Cache als Rückfall. Nur Nachrichten mit passendem Typ verarbeiten; nur Favoritenlisten (Name, Koordinaten, Region) austauschen.
  - `useFavoritePlaces` wird asynchron initialisiert (erst Bridge-Antwort abwarten, dann Liste setzen) und behält Event-Synchronisation zwischen mehreren Fenstern derselben Seite.
- Host-Snippet (`src/routes/embed-info.tsx`, ggf. `src/components/embed-shell.tsx`): der bestehende Snippet-Zusatzcode erhält einen Listener, der `otw:fav:get`/`otw:fav:set` gegen `localStorage` der WordPress-Seite auflöst — nur für Nachrichten von der eigenen Fenster-Adresse und nur unter dem Schlüssel `otw:lokal-favorites`.
- `src/components/weather-widget.tsx`: Hinweiszeile mit Link „in eigenem Tab öffnen“, wenn dauerhaftes Speichern im Fenster nicht möglich ist.

## Prüfung

- Typecheck und Build.
- Browsertest: Test-Hostseite mit eingebettetem Fenster — Favorit setzen, neu laden, Favorit noch da; ohne Snippet-Listener greift der Hinweis; Website-Ansicht unverändert.
