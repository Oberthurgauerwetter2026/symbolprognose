# Satellitenbild-Embed: Stocken auf der Webseite beheben

## Befund (im Code geprüft)

Das Embed `/embed/satellit-loop` läuft in einem iframe auf der WP-Seite und erzeugt dauerhaft Last — auch dann, wenn es gar nicht sichtbar ist. Vier Punkte sind belegt:

1. **Alle Zeitschritte neu aufbauen, jede Minute.** Das Manifest wird alle 60 s neu geladen (`refetchInterval: 60_000`). Dabei entsteht ein neues `frames`-Array, das als Abhängigkeit des Lade-Effekts hängt (`satellite-map.tsx:413`). Folge: Alle 18 Kachel-Ebenen werden abgebaut und komplett neu geladen — auch wenn sich kein einziger Zeitpunkt geändert hat. Das ist der Haupt-Ruckler (Netz + Bild-Dekodierung im Minutentakt).

2. **Blitz-Marker werden 2× pro Sekunde komplett neu gebaut.** `LightningLayer` hängt an `frameTime` (`satellite-map.tsx:224`). Während die Animation läuft, wechselt `frameTime` alle 500 ms, und jedes Mal werden alle Marker gelöscht und als neue `divIcon`-SVGs wieder angelegt. Bei vielen Blitzen sind das hunderte DOM-Knoten pro Sekunde.

3. **Die Animation läuft immer weiter** — auch wenn der Tab im Hintergrund liegt oder das iframe weit unterhalb des Sichtbereichs steht. Es gibt keine Pause bei `visibilitychange` und keine Sichtbarkeitsprüfung.

4. **Doppelte Kachelauflösung** wird auf allen Retina-Geräten angefordert (512 → 1024 px JPEG pro Kachel, × 18 Zeitschritte). Auf Mobilgeräten ist das viel Dekodier- und Speicheraufwand für ein kleines Embed.

## Änderungen

1. **Zeitachse stabil halten.** Der Lade-Effekt bekommt als Abhängigkeit einen Signatur-String der Frame-Zeiten statt des Array-Objekts. Ändern sich die Zeitpunkte nicht, passiert beim Manifest-Refresh nichts mehr. Kommt ein neuer Zeitschritt hinzu, werden nur die fehlenden Ebenen nachgeladen statt alle.
2. **Blitze entkoppeln.** Die Marker werden weiterhin nach Alter eingefärbt, aber nur noch neu aufgebaut, wenn sich die Blitzdaten ändern oder der Frame um mindestens einen Alterungsschritt weiterrückt (gerundet auf 1 Minute) — nicht mehr bei jedem 500-ms-Frame. Zusätzlich eine Obergrenze an gleichzeitig gezeichneten Blitzen (neueste zuerst).
3. **Pausieren, wenn nicht sichtbar.** Animation, Manifest-Refresh und Blitz-Refresh stoppen, sobald das Dokument versteckt ist oder das Embed per `IntersectionObserver` ausserhalb des Sichtbereichs liegt; sie laufen automatisch weiter, wenn es wieder sichtbar wird.
4. **Kachelauflösung im Loop-Embed begrenzen.** Im `loop`-Modus keine Supersampling-Kacheln; auf grossen Bildschirmen bleibt die Hauptansicht unverändert scharf.
5. **Snippet-Hinweis:** Im Embed-Snippet `loading="lazy"` am iframe, damit das Widget erst beim Heranscrollen startet.

Optik, Blitzdarstellung, Loop-Verhalten und Quellenangaben bleiben unverändert.

## Technisch

- `src/components/maps/satellite-map.tsx`
  - `FrameStack`: `framesKey = frames.map(f => f.time).join(",")` als Effekt-Dependency; `frames` über Ref lesen. Mount-Logik idempotent halten (bestehende Ebenen nicht neu anlegen).
  - `LightningLayer`: zusätzliche Prop `frameBucket` (Frame-Zeit auf Minuten gerundet) als Dependency statt `frameTime`; `MAX_BOLTS` Begrenzung.
  - Neuer `useVisiblePlayback`-Hook (oder Inline-Effekt) mit `document.visibilityState` + `IntersectionObserver` auf `wrapperRef`; Ergebnis gated `playing`-Interval, `refetchInterval` des Manifests und der Blitze (`refetchInterval: visible ? … : false`).
  - `hiDpiWms`: Supersampling nur wenn nicht `loop`.
- `src/routes/embed-info.tsx`: `loading="lazy"` im generierten iframe-Snippet für Satellit-Loop.

## Prüfung

Preview des Embeds im Browser laden, Netzwerk über zwei Minuten beobachten (keine kompletten Frame-Neuladungen mehr), und während der Animation die DOM-Knotenzahl der Blitz-Ebene stabil sehen.
