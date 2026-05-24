## Ziel
Aktuell ist die Stundenleiste unter dem Slider im Tages-Modus deaktiviert (ausgegraut, keine Reaktion auf Klicks). Sie soll auch im Tages-Modus klickbar sein und beim Klick automatisch in den Stunden-Modus wechseln und an die gewählte Stunde springen.

## Änderung
**`src/components/region-map.tsx`** (Stundenleisten-Container, Zeilen ~760–776):

- `pointer-events-none opacity-40` im Daily-Modus entfernen — Leiste bleibt sichtbar und voll aktiv. Optional eine sehr dezente visuelle Unterscheidung (z. B. leicht reduzierter Kontrast) beibehalten, aber klickbar.
- `onPointerDown` immer registrieren (nicht mehr modusabhängig).
- Im Handler zusätzlich `setViewMode("hourly")` aufrufen, bevor `setStepOffset(...)` gesetzt wird.
- `cursor-pointer` immer aktiv.

Die Tick- und Label-Spans behalten `pointer-events-none`, damit Klicks am Container landen. Der Radix-Slider selbst bleibt unverändert.

## Ergebnis
Egal ob im Tages- oder Stunden-Modus: Ein Klick/Tap auf die Stundenleiste (06:00, 09:00 …) springt zur entsprechenden Stunde und schaltet den View automatisch auf „Stunden".