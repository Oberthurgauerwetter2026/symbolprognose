In `src/components/maps/radar-map.tsx`:

1. **Zoom zurück auf 9.5** (`MapContainer zoom={9.5}`).
2. **„Jetzt"-Button entfernen** aus der Sekundär-Toolbar.
3. **„Hagel" ins Zahnrad-Popover verschieben** als Switch (analog zum Auto-Loop), mit deaktiviertem Zustand wenn `!data.hasHail`.
4. Die nun leere Sekundär-Toolbar (`mt-1.5 flex flex-wrap …`) komplett entfernen → Overlay-Panel wird vertikal um ~28 px schlanker, nur noch eine Zeile (Play | Slider | Next | ⚙).
5. Den `Hinweis: …`-Text (Daten-Warnung) als kleinen Hinweis unter den Slider in derselben Panel-Box rendern, falls vorhanden — bleibt optisch dezent.