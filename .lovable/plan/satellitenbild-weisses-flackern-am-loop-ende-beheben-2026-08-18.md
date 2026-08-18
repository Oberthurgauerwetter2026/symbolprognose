# Satellitenbild: weisses Flackern am Loop-Ende beheben

## Befund (im Code geprüft)

`src/components/maps/satellite-map.tsx` hält nur ein Fenster von Kachel-Ebenen um den aktiven Zeitschritt (`WINDOW_BACK = 3`, `WINDOW_AHEAD = 6`), alle anderen werden entfernt (`unmountFrame`).

Der Autoplay-Sprung wählt den nächsten Zeitschritt aus `loadedSet` — und das ist die Menge der *je einmal* geladenen Frames (`everLoadedRef`), nicht der aktuell montierten. Beim Loop-Ende springt der Index von letztem Frame auf 0. Frame 0 ist zu diesem Zeitpunkt aus der Karte entfernt: die Sichtbarkeitszeile setzt Deckkraft 1 für einen Layer, der nicht existiert — die Karte zeigt kurz nur den leeren Hintergrund, bis Frame 0 neu montiert und geladen ist. Das ist das weisse Flackern.

## Änderungen

1. **Loop-Anfang im Fenster halten.** Das Frame-Fenster umschliesst die Zeitachse ringförmig: die Nachbarn werden modulo Anzahl Frames berechnet, sodass beim letzten Zeitschritt schon die ersten Frames wieder vorgeladen sind. Damit ist Frame 0 beim Wrap bereits montiert und geladen.
2. **Nie auf einen leeren Frame umschalten.** Der aktuell sichtbare Frame bleibt sichtbar, bis der Ziel-Frame tatsächlich als Layer vorhanden und geladen ist. Fehlt er, wird er sofort montiert und der Wechsel erst nach dessen `load` vollzogen — kein Zwischenbild mit leerer Karte mehr.
3. **Autoplay nur auf montierte Frames springen.** Die Auswahl des nächsten Zeitschritts nutzt die Menge der aktuell montierten/geladenen Ebenen statt „je geladen“; ist noch keiner bereit, bleibt der Loop einen Takt beim aktuellen Bild stehen.

Optik, Loop-Verhalten, Zeitanzeige und Quellenangaben bleiben unverändert; die Speicherbremse (Fenstergrösse) bleibt gleich gross.

## Technisch

- `FrameStack`:
  - `ensureWindow`: Nachbarindizes zyklisch (`(c + d + n) % n`) statt geklammert; `keep`-Set entsprechend.
  - Neue Ref mit den aktuell geladenen, montierten Indizes; nach oben gemeldet (`onProgress` bleibt für den Filmstrip, zusätzlich ein `onMountedReady`-Callback oder ein geteiltes Ref).
  - Sichtbarkeits-Effekt: Ziel-Layer nur einblenden, wenn `layersRef.current[i]` existiert und in `loadedRef` steht; sonst mounten und in dessen `load`-Handler die Umschaltung nachziehen (vorheriger Layer bleibt bis dahin auf Deckkraft 1).
- `SatelliteMap`: Autoplay-Interval prüft die montiert-geladene Menge; bei leerer Menge kein Indexwechsel.

## Prüfung

Embed und `/karten/satellit` im Browser über mindestens zwei komplette Durchläufe beobachten und den Übergang letzter Frame → erster Frame per Screenshot-Serie kontrollieren (kein leeres Bild dazwischen).
