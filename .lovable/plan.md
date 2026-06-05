## Ziel

Auf der Region-Karte (`/karten/region`) soll ein Klick/Tap in den Zeit-Slider die Ansicht automatisch von **Tagesübersicht** auf **Stündlich** umschalten — unabhängig davon, wo geklickt wird.

## Aktuelles Verhalten

In `src/components/region-map.tsx` (Zeilen 869–878) ist der `<Slider>` im Daily-Modus mit `disabled={viewMode === "daily"}` gesetzt. Dadurch reagiert er nicht auf Klicks; der Wechsel auf "Stündlich" geht heute nur über den Tab "Stündlich" oder den "Jetzt"-Button.

## Änderung

In `src/components/region-map.tsx`:

1. `disabled={viewMode === "daily"}` am `<Slider>` entfernen, damit der Slider auch im Daily-Modus klickbar ist.
2. `onValueChange` so erweitern, dass bei aktivem Daily-Modus zusätzlich `setViewMode("hourly")` aufgerufen wird, bevor `setStepOffset(v[0] ?? 0)` läuft. Damit reicht ein einziger Klick irgendwo in den Track, um auf Stündlich zu wechseln und gleich die angeklickte Stunde zu setzen.
3. Der Wrapper um den Slider/die Stunden-Ticks (Zeilen ~829–879) bleibt unverändert; insbesondere die Klasse `pointer-events-none opacity-40` auf dem Hour-Ticks-Container (Zeile 803) wird nicht angefasst — sie betrifft nur die Tick-Beschriftungen, nicht den Slider selbst.

## Nicht betroffen

- Daily-Tabs, "Jetzt"-Button, Marker, Datenabruf und Aggregation bleiben unverändert.
- Keine Backend-/Server-Function-Änderungen.
