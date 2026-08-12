# Satellitenbild: Hänger bei Störung der Bildquelle abfangen

## Befund (jetzt live geprüft, 16:05 UTC)

Der EUMETSAT-Bilddienst (EUMETView WMS) antwortet aktuell auf **jede** Anfrage mit
`504 Gateway Time-out` — sowohl GeoColour als auch Infrarot, und selbst die
Layer-Liste (GetCapabilities) läuft in eine Zeitüberschreitung. Gemessen: 10–15 s
Wartezeit pro Kachel, danach Fehler.

Das ist eine Störung beim Datenanbieter, nicht im Code. Der aktuelle Code macht
den Ausfall aber unnötig schmerzhaft:

- Es gibt keine Zeitgrenze pro Zeitschritt. Hängt eine Kachel 15 s (oder länger),
  bleibt einer der drei Ladeplätze blockiert, und die Karte wirkt „eingefroren".
- Der Reserve-Layer wird nur einmal probiert. Ist der ganze Dienst weg, hilft er
  nicht — es wird trotzdem weiter still geladen.
- Für den Nutzer sieht es aus wie ein Bug: Zähler bleibt stehen, kein Bild,
  keine Meldung.

## Was geändert wird

1. **Zeitgrenze pro Zeitschritt (12 s).** Kommt in dieser Zeit kein Bild, gilt der
   Zeitschritt als fehlgeschlagen und der Ladeplatz wird sofort frei. Damit kann
   die Warteschlange nie mehr hängen.
2. **Störungserkennung.** Scheitern die ersten Zeitschritte alle (z. B. 4 in Folge
   ohne einen Erfolg), wird das Laden gestoppt statt endlos weiterzuprobieren.
3. **Klare Meldung statt Standbild.** In der Karte erscheint dann ein dezenter
   Hinweis: „Satellitenbilder derzeit nicht verfügbar (Störung bei EUMETSAT)" mit
   einem Button „Erneut versuchen", der das Laden neu startet.
4. **Automatischer erneuter Versuch** einmal nach 60 s, damit die Karte sich nach
   dem Ende der Störung von selbst füllt.
5. **Reserve-Layer nur bei echtem Layer-Fehler.** Umschalten nur, wenn einzelne
   Zeitschritte scheitern, während andere laden — bei Komplettausfall nicht mehr,
   das erspart einen kompletten Neuaufbau aller Zeitschritte.

Die Animation, der Filmstrip, die Blitz-Anzeige und die Bildqualität bleiben
unverändert.

## Technisch

- `src/components/maps/satellite-map.tsx`, `FrameStack`:
  - `mountFrame`: `window.setTimeout(…, FRAME_TIMEOUT_MS = 12_000)` je Frame, der
    wie `tileerror` in `settle(i, false)` mündet; Timer in `load`/`tileerror`/
    Cleanup löschen.
  - Zähler `failStreak` / `anySuccessRef`; bei `failStreak >= 4 && !anySuccess`
    → `cancelled = true`, Queue leeren, `onOutage(true)` nach oben melden.
  - Fallback-Umschaltung an `anySuccessRef.current === true` binden.
  - Neuer `reloadKey`-State in `SatelliteMap`, der als Effekt-Dependency den
    Frame-Stack neu aufbaut (Button + `setTimeout` 60 s).
- Overlay-Hinweis im bestehenden Status-Bereich der Karte (gleiche
  Glassmorphic-Pille), keine neue Komponente.
