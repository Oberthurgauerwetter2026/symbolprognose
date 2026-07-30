## Warum es anders aussieht

Im Embed (`bare`-Modus) rendert `src/components/maps/warn-map.tsx` den Abo-Bereich bewusst nicht mit (`{!bare && …}`). Stattdessen setzt die Route `src/routes/embed.warnungen.tsx` einen eigenen Kasten „Push-Benachrichtigungen aktivieren“ **unterhalb** des Grids über die volle Breite. Zusätzlich sind im Embed die rechte Spalte schmaler (240–300 px statt 260–320 px) und die Höhe kleiner (max. 620 px statt 760 px).

## Änderung: Embed an die App angleichen

1. **`src/components/maps/warn-map.tsx`**
   - Den Abo-Block auch im `bare`-Modus in der rechten Spalte (`aside`) rendern, direkt unter dem Info-Panel – identisch zur App-Ansicht, inkl. `PushOptIn` mit `embedded`-Verhalten (Hinweis „In eigenem Tab öffnen“ bleibt).
   - Spaltenbreite im Embed auf `minmax(260px,320px)` und Höhe auf `clamp(420px,60vh,760px)` setzen, also gleich wie in der App.

2. **`src/routes/embed.warnungen.tsx`**
   - Den separaten Kasten unterhalb der Karte entfernen, da der Inhalt jetzt in der Spalte steht. Padding-Wrapper bleibt.

3. **`src/components/warnings/push-opt-in.tsx`**
   - Nur prüfen, dass die kompakte Embed-Variante in der schmalen Spalte sauber umbricht; ggf. minimale Anpassung an Abständen.

## Verifikation
TypeScript-Check und Screenshots von `/embed/warnungen` und `/karten/warnungen` bei 390 px, 768 px und 1440 px, um identische Spaltenbreiten, Höhen und Position des Abo-Bereichs zu bestätigen.
