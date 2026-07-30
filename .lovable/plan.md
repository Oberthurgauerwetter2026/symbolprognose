## Ziel
Die Warnkarte soll sich flüssig an die verfügbare Breite/Höhe anpassen – auf Desktop, Tablet und Mobile – statt fixe Pixelhöhen (380px / 520px / 700px) zu verwenden.

## Aktueller Stand
In `src/components/maps/warn-map.tsx`:
- Kartencontainer (Zeile 399): `h-[380px] sm:h-[520px] lg:h-full lg:min-h-[700px]`
- Info-Panel (Zeilen 528/534): feste `min-h-[700px]` in Desktop-/Embed-Modus
- Warnliste (Zeile 558): `max-h-[70vh]`

Diese festen Werte führen dazu, dass die Karte auf kleinen Displays zu hoch/zu niedrig und auf grossen Monitoren nicht mitwächst.

## Änderungen (nur `src/components/maps/warn-map.tsx`)

1. **Karte mit Seitenverhältnis statt fixer Höhe**
   - Mobil: `aspect-[4/3]` mit `min-h-[300px]`, so skaliert die Höhe mit der Breite.
   - Ab Tablet/Desktop: Höhe über `clamp()` an den Viewport gekoppelt, z. B. `h-[clamp(420px,60vh,760px)]`, im zweispaltigen Layout weiterhin `lg:h-full` (Karte folgt der Panelhöhe).

2. **Info-Panel dynamisch**
   - `min-h-[700px]` ersetzen durch dieselbe `clamp()`-Höhe, damit Karte und Panel gleich hoch bleiben und gemeinsam mitwachsen.
   - Panel behält Flex-Struktur: Header fix, Warnliste `flex-1 overflow-y-auto`.

3. **Warnliste**
   - `max-h-[70vh]` entfällt zugunsten von `flex-1 min-h-0`, damit die Liste exakt den Restplatz füllt statt eine eigene Grenze zu setzen.

4. **Spaltenumbruch feiner**
   - Zweispaltiges Layout weiterhin über Container-Queries (`@lg` im Embed, `@3xl` in der App), Panelspalte auf `minmax(260px,320px)` flexibilisieren, damit sie bei mittleren Breiten nicht klemmt.

5. **Embed-Modus**
   - Da `/embed/warnungen` seine Höhe per postMessage meldet, bleibt die Höhe inhaltsgetrieben; die `clamp()`-Werte werden im `bare`-Modus etwas niedriger angesetzt, damit iframes nicht überlaufen.

## Verifikation
TypeScript-Check plus Screenshots bei 375px, 768px, 1280px und 1728px Breite (App-Route und Embed-Route), um Karte und Panel auf gleiche Höhe und lesbare Warnmeldungen zu prüfen.
