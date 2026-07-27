## Ziel

Eine Wetterwarnkarte für den Oberthurgau: Gemeinden als eingefärbte Umrisse mit Namen, Warnungen pro Gemeinde manuell erfassbar, automatische Gewitterwarnungen aus dem Radar, Anzeige in Region-/Lokalprognose, Embed-Snippet und Web-Push-Abo.

## 1. Gemeindegrenzen

- Gemeinde-Polygone (swissBOUNDARIES via geo.admin) für alle Oberthurgau-Gemeinden einmalig holen, vereinfachen und als `src/data/gemeinden.json` ablegen (`bfs_nr`, `name`, Geometrie).
- Warn-„Regionen" = Gemeinden. Zusätzlich Gruppen „Alle Gemeinden", „Seeufer", „Hinterland" für Sammelwarnungen.

## 2. Karte `/karten/warnungen`

- Gleiches Kartenprofil wie Radar/Wind (swisstopo-Basiskarte + Relief), aber engerer Zoom/Bounds auf den Oberthurgau.
- Gemeindeumrisse mit Namenslabel; Füllfarbe = höchste aktive Warnstufe (grün / gelb / orange / rot).
- Banner oben: Symbolreihe Gewitter, Regen, Schnee, Strassenglätte, Wind, Frost — Symbol in Warnfarbe, Text nur als Tooltip/Hover.
- Legenden-Button in der Karte öffnet Overlay mit Stufen-Erklärung.
- Klick auf Gemeinde: Panel rechts in der Karte mit Symbol + Warntitel in Stufenfarbe, „[Gefahr]warnung (Stufe N)", Region, gültig von/bis, Beschreibung, „Mögliche Auswirkungen" (1 Satz).
- Neuer Tab in `maps-config.ts` und in den Kartenreitern.

## 3. Datenmodell (Lovable Cloud)

- `warnings`: id, hazard (gewitter|regen|schnee|glaette|wind|frost), level 1–3, valid_from, valid_to, description, impact, params (Menge mm / km/h / °C, optional), active, source (manual|auto), created_at.
- `warning_regions`: Zuordnung Warnung ↔ Gemeinde (n:m), damit eine Warnung mehrere Regionen abdeckt.
- `push_subscriptions`: Endpoint/Keys + abonnierte Gemeinden.
- Öffentlicher Lesezugriff nur auf aktive Warnungen; Schreiben ausschliesslich serverseitig hinter dem Admin-Passwort.

## 4. Admin `/admin/warnungen`

- Zugang wie bisher über das bestehende Admin-Passwort (Session), Passwortprüfung serverseitig.
- Formular: Gefahr wählen → Stufe wählen → Textvorlage wird automatisch eingesetzt und ist editierbar; Regionen einzeln, mehrfach oder „alle" wählbar; Zeitraum von/bis; optionale Zahlenwerte (mm, km/h, °C) werden in den Text eingefügt.
- Liste aller Warnungen mit Aktivieren / Deaktivieren / Löschen / Duplizieren, Live-Vorschau der Kartenfärbung.
- Textvorlagen-Katalog: je Gefahr × Stufe ein kurzer, sachlicher Beschreibungstext plus ein Auswirkungssatz — einheitlich im Stil eines offiziellen Wetterdienstes.

## 5. Automatische Gewitterwarnung aus Radar

- Serverjob (stündlich/alle 15 min, an bestehende Radar-Ingest-Kette gehängt): erkennt Gewitterzellen in den Radar-/Nowcast-Feldern, schätzt Zugrichtung und Geschwindigkeit aus zwei aufeinanderfolgenden Feldern und extrapoliert die Zellbahn.
- Trifft die Bahn innerhalb der nächsten ~60 Minuten eine Gemeinde, wird automatisch eine Gewitterwarnung mit passender Stufe (Intensität) und Gültigkeit gesetzt, gekennzeichnet als „automatisch".
- Automatische Warnungen laufen selbst ab und werden zurückgenommen, wenn die Zelle abzieht; manuelle Warnungen haben Vorrang und werden nie überschrieben.

## 6. Anzeige in Region- und Lokalprognose

- Warnbadge mit Gefahrensymbol und Stufenfarbe oberhalb der Prognose, wenn für den Ort/die Gemeinde eine aktive Warnung existiert; Klick öffnet die Warndetails.

## 7. Embed-Snippet

- Neue Route `/embed/warnungen` (Karte + Banner + Popup, ohne App-Chrome) plus Eintrag mit Copy-Snippet in `/embed-info`.

## 8. Web-Push

- Abo-Button auf der Warnkarte: Nutzer wählt Gemeinden und erlaubt Benachrichtigungen.
- Service Worker nur für Push; Versand serverseitig beim Aktivieren einer Warnung (neu oder Stufenerhöhung), begrenzt auf die abonnierten Gemeinden.
- Dafür wird ein VAPID-Schlüsselpaar erzeugt und sicher im Backend hinterlegt.

## Technisches

- Karte als eigene Komponente `src/components/maps/warn-map.tsx` auf Basis des bestehenden Leaflet/swisstopo-Setups.
- Lesen der Warnungen über eine öffentliche Server-Funktion mit kurzem Cache; Admin-Mutationen über passwortgeschützte Server-Funktionen.
- Radar-Zellenerkennung als Server-Route unter `src/routes/api/public/warnings/auto-thunder.ts`, abgesichert mit dem bestehenden Trigger-Secret.

## Reihenfolge

1. Gemeindedaten + Karte mit Banner/Legende/Popup (mit Testdaten)
2. Datenmodell + Admin-Tool + Vorlagen
3. Anzeige in Region-/Lokalprognose + Embed-Snippet
4. Auto-Gewitterwarnung aus Radar
5. Web-Push
