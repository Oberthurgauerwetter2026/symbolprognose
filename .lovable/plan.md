# Sticky-Verhalten im Lokalprognose-Header entfernen

## Ziel

Der Header der Lokalprognose soll nicht mehr sticky bleiben, wenn der Benutzer scrollt. Die prominente Orts-Badge (Akzent-Pille mit MapPin) bleibt erhalten.

## Änderung

1. In `src/components/weather-widget.tsx` am `<header>` des `Header`-Komponenten:
   - Entfernen: `sticky top-0 z-20 bg-zinc-100 shadow-sm`
   - Beibehalten: `flex flex-col @[640px]:flex-row @[640px]:items-end justify-between gap-4 @[640px]:gap-6 pb-4 border-b border-zinc-200`
   - Keine weiteren Layout-Änderungen; die Akzent-Pille für den Ortsnamen bleibt wie aktuell.

## Prüfung

- Visueller Check auf Desktop und Mobile, dass der Header nicht mehr oben haftet.
- Typecheck und Build laufen durch.