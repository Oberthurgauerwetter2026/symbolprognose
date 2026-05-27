## Ziel
Das Kartensymbol im Lokalprognose-Header (aktuell Emoji `🗺` neben „Karte") moderner gestalten.

## Änderung (`src/components/weather-widget.tsx`)

1. **Import erweitern** (Z. 17): `Map` aus `lucide-react` ergänzen.
2. **Header-Button** (Z. 453–460):
   - Emoji `🗺` durch `<Map className="w-4 h-4" aria-hidden />` ersetzen.
   - Button-Styling leicht modernisieren:
     - Hintergrund auf weiss (`bg-white`) mit `shadow-sm`.
     - Hover: `hover:bg-zinc-50` + `hover:border-zinc-300`.
     - Sanfter Übergang (`transition-all`), Icon in `text-accent` für dezenten Farbakzent.

## Nicht geändert
- Link-Ziel (`/karte`), Label-Text „Karte", Tooltip.
- Position/Layout im Header.

## Validierung
- Mobile (390 px) und Desktop: Icon vertikal mittig, Button-Höhe unverändert (h-10).
