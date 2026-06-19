# Tooltips im Wetter-Widget mobil per Tap nutzbar machen

## Problem
Die Radix `Tooltip`-Komponenten im Stunden-Niederschlagspanel (und in der Legende darüber) öffnen sich nur per Hover. Auf Touch-Geräten gibt es keinen Hover → die Tooltips mit `mm`, `Regenrisiko` und `10–90 %`-Band sind nicht erreichbar.

## Lösung
Die bestehenden Radix-`Tooltip`-Instanzen in `src/components/weather-widget.tsx` so erweitern, dass sie zusätzlich per Tap geöffnet werden. Optisch und desktopseitig bleibt alles wie heute.

### Betroffene Stellen
1. Stunden-Bars (~Z. 1142–1197): Tooltip pro Stunde mit mm / Risiko / Quantilband.
2. Legende darüber (~Z. 653–692): gleiche Komponente, dieselbe Behandlung für Konsistenz.

### Mechanik
- Lokaler State `openIdx: number | null` pro Panel-Block (Stundenleiste bzw. Legende, jeweils eigener State).
- Jeder `Tooltip` wird controlled:
  - `open={openIdx === k}`
  - `onOpenChange` setzt/löscht `openIdx` (damit Hover auf Desktop weiter funktioniert).
- Auf dem Trigger-`<span>`:
  - `onClick`: toggelt `openIdx` (öffnet bei Tap, schließt beim erneuten Tap).
  - `onPointerDown` mit `e.preventDefault()` für `pointerType === 'touch'`, damit Radix den Tap nicht sofort wieder als „outside" interpretiert und schließt.
  - `role="button"`, `tabIndex={0}`, `aria-expanded` für A11y.
- `TooltipProvider` bekommt zusätzlich `disableHoverableContent={false}`; `delayDuration` bleibt 150.
- Outside-Tap: ein globaler `onPointerDown`-Listener auf dem umschließenden Stunden-Container setzt `openIdx` zurück, wenn das Target keine Bar ist. Für die Legende identisch.

### Nicht im Scope
- Keine Änderung an Daten, Aggregation, Farben, Layout oder Desktop-Verhalten.
- Keine Umstellung auf `Popover`/`HoverCard` (würde Markup/Styling unnötig ändern).
- Andere `title=`-Attribute (Tages-Sparkline, Sonnenstunden, Schnee) bleiben unangetastet — separate Folgeaufgabe falls gewünscht.

## Verifikation
- Desktop: Hover öffnet Tooltip wie bisher, Klick toggelt zusätzlich.
- Mobile-Viewport im Preview: Tap auf eine Stundenbar öffnet Tooltip mit mm / Risiko / 10–90 %; Tap daneben schließt; Tap auf andere Bar wechselt.
- `npx tsc --noEmit` bleibt grün.
