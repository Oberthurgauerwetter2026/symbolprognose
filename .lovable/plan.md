# Push-Titel: Symbole an die Karte angleichen

## Ausgangslage (geprüft)

Die 18 Symbolbilder unter `public/warn-icons/` sind aktuell und identisch mit den Kartensymbolen – auch auf der veröffentlichten Adresse. Auf iPhone/iPad zeigt Apple in Web-Push-Meldungen jedoch **immer** das Home-Bildschirm-Icon der App und ignoriert das mitgesendete Bild. Sichtbar bleibt dort nur das Zeichen im Titel – und das sind derzeit Emojis, die nicht zu den Kartensymbolen passen (z. B. 🌧️ statt Tropfen, 🧊 statt Strassenglätte, 💨 statt Windsack).

Eigene SVG-Symbole lassen sich in einem Benachrichtigungs-Titel technisch nicht darstellen; dort sind nur Text/Unicode möglich. Wir wählen deshalb die Zeichen, die den Kartensymbolen am nächsten kommen.

## Umsetzung

1. Emoji-Zuordnung im Push-Titel neu setzen, näher an der Karte:
   - Gewitter: ⚡ (Blitz, wie Karte)
   - Regen: 💧 (Tropfen statt Wolke-mit-Regen)
   - Wind: 🎏 (Windsack statt Luftstoss)
   - Schnee: ❄️ (Schneekristall, wie Karte)
   - Strassenglätte: 🛞 (Rad/Schleudergefahr statt Eiswürfel)
   - Frost: 🌡️ (Thermometer, wie Karte)
2. Zusätzlich die Warnstufe farbig im Titel kennzeichnen, damit die Stufe auch auf iOS erkennbar ist: 🟡 / 🟠 / 🔴 direkt nach dem Gefahrensymbol.
   Beispiel: `⚡ 🔴 Gewitterwarnung (Stufe 3) für Amriswil`
3. Für Android/Desktop bleibt alles unverändert – dort erscheint weiterhin das echte Kartensymbol als Bild.

## Technische Details

- Änderung nur in `src/lib/push.server.ts`: `emoji`-Map anpassen und Stufen-Kreis im `title` ergänzen.
- Keine Änderungen an `public/warn-icons/`, `push-sw.js`, Datenbank oder Karte.
- Hinweis: Bestehende, bereits gesendete Meldungen ändern sich nicht; die neue Darstellung gilt ab dem nächsten Versand.
