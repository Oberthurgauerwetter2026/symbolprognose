## Plan

1. **Timeline an Radarbewegung koppeln**
  - Die Timeline bekommt einen eigenen schnellen Anzeigezustand, der beim Scrubben und bei der automatischen Animation sofort mitläuft.
  - Der sichtbare Griff/Bubble wird nicht mehr nur über React-Framewechsel aktualisiert, sondern während Drag/Play direkt per `requestAnimationFrame` geführt.
  - Beim Wechsel zwischen Messung und Prognose bleibt die Bubble korrekt auf dem jeweils gesnappten Zeitpunkt: Messung im 5-Minuten-Takt, Prognose im Prognose-Takt.
2. **Ruckeln auf Desktop reduzieren**
  - Teure Radar-Neuberechnungen während Scrubbing/Animation vermeiden: bestehende Canvas-Frames konsequenter cachen und nicht unnötig bei jeder kleinen UI-Bewegung neu erzeugen. Problem betrifft vor allem bei der Prognose; Messung weniger betroffen
  - Radar-PNG-Frames stabiler vorladen und ImageOverlay-Wechsel so umbauen, dass der Browser nicht bei jedem Frame einen sichtbaren Layout-/Layer-Wechsel macht.
  - Während automatischer Animation keine unnötigen State-Updates pro RAF auslösen; nur der Timeline-Griff läuft kontinuierlich, der Radarframe wechselt diskret.
3. **Timeslider moderner gestalten**
  - Das untere Bedienpanel kompakter und klarer machen: moderner Track mit Messung/Prognose-Zonen, markanterem Handle, besser lesbarer Zeit-Bubble und weniger kleinteiligen Tick-Labels.
  - Controls bleiben wie bisher: Play/Pause, Vor/Zurück, Speed, Hagel-Option.
  - Desktop wird glatter und präziser, Mobile bleibt unverändert gut bedienbar.
4. **NS-Messung weniger pixelig, aber nicht weichgezeichnet**
  - Die Messungs-PNGs nicht mehr brutal `pixelated` skalieren.
  - Stattdessen eine „crisp but finer“-Darstellung wie im Screenshot: harte Farbbänder behalten, aber die sichtbaren Rasterblöcke kleiner/sauberer wirken lassen.
  - Prognose-Canvas bleibt getrennt davon; dort werden weiterhin konturierte, harte Niederschlagsfelder ohne Blur gerendert.
5. **Validierung**
  - Lokal `/karten/radar` bzw. `/karten/lokal` im Desktop-Viewport prüfen: Scrubben, Play-Animation, Messung→Prognose-Übergang, Timeline-Führung.
  - Screenshot-Vergleich für NS-Messung: harte Bänder, weniger grobe Pixel, kein weichgespültes Blur.