In `src/components/maps/radar-map.tsx` am `PopoverContent` (Zahnrad-Popup):

- **Volldeckend statt halbtransparent**: explizite Klassen `bg-white text-neutral-900 border-neutral-200 shadow-xl` (Popover-Default greift `bg-popover` und bekommt vom Glas-Panel darunter den Eindruck einer Transparenz; mit fester `bg-white` ist es eindeutig deckend).
- **Vollständig sichtbar / nicht verdeckt**: 
  - `z-[1000]` setzen, damit es über der Karten-Legende (`z-[400]`) und allen Overlays liegt.
  - `collisionPadding={12}` an `PopoverContent`, damit Radix das Popup automatisch verschiebt, wenn es an den Rand stösst.
  - `sideOffset={8}` für etwas mehr Abstand zum Zahnrad-Knopf.
  - Breite leicht erhöhen: `w-60` (vorher `w-56`), damit „Hagel (POH) — Wahrscheinlichkeit einblenden" auf einer Zeile bleibt.