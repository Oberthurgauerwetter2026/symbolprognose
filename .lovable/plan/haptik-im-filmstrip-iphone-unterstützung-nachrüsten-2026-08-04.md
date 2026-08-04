# Haptik im Filmstrip: iPhone-Unterstützung nachrüsten

## Warum nichts spürbar ist

Die aktuelle Umsetzung nutzt `navigator.vibrate(...)`. Diese API existiert in Safari auf iPhone/iPad **nicht** — der Aufruf wird schlicht ignoriert (und wird durch die `"vibrate" in navigator`-Prüfung sogar ganz übersprungen). Auf Android-Chrome funktioniert sie, aber nur wenn das Gerät nicht im Lautlos/Fokus-Modus ist und die Seite eine Nutzerinteraktion hatte.

Da die Vorschau auf einem iPhone-Viewport läuft, ist genau das der wahrscheinliche Grund für „merke nichts".

## Geplante Änderungen

### 1. iOS-Haptik über den Switch-Trick
Safari löst systemweite Haptik aus, wenn ein `<input type="checkbox" switch>` per Label-Klick umgeschaltet wird (ab iOS 17.4). Wir bauen einen kleinen, unsichtbaren Haptik-Helfer:

- Neue Datei `src/lib/haptics.ts` mit `haptic(strength)`.
- Bei Support von `navigator.vibrate`: wie bisher vibrieren.
- Sonst (iOS): einmalig ein verstecktes `<label>` + `<input type="checkbox" switch>` in den Body hängen und bei jedem Haptik-Event das Label programmatisch klicken. Das erzeugt ein kurzes Tap-Feedback.
- Feature-Erkennung über `"switch" in document.createElement("input")`.

### 2. Filmstrip auf den Helfer umstellen
In `src/components/maps/filmstrip-timeline.tsx`:
- `isCoarsePointer()` nicht mehr an `"vibrate" in navigator` binden (das schließt iPhones aus), sondern nur an `pointer: coarse`.
- `hapticFor()` und der Impuls in `onPointerDown` rufen `haptic(...)` aus dem neuen Modul auf.

### 3. Test-Möglichkeit
Damit prüfbar ist, ob das Gerät überhaupt Haptik liefert, löst der Impuls beim Antippen des Filmstrips (Pointer-Down) weiterhin sofort aus — das ist der einfachste Prüfpunkt am Handy.

## Einschränkungen (wichtig)

- Auf iPhone gibt es keine steuerbare Intensität; alle Stufen (Messung / Prognose / Tageswechsel) fühlen sich gleich an. Die Abstufung bleibt nur auf Android wirksam.
- Ist auf dem iPhone „Systemhaptik" in Einstellungen › Töne & Haptik ausgeschaltet, bleibt es stumm — das lässt sich vom Web aus nicht umgehen.
- In der Lovable-Vorschau (iframe) kann Haptik zusätzlich blockiert sein; verlässlich testbar ist es auf der veröffentlichten Seite bzw. als PWA.

## Betroffene Dateien

- `src/lib/haptics.ts` (neu)
- `src/components/maps/filmstrip-timeline.tsx`
