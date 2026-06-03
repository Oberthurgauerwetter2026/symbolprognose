## Ziel
Manuelles Sliden auf der Radar-Timeline soll flüssig sein — kein Stocken, keine Layer-Remounts pro Frame.

## Ursache
1. `<ImageOverlay key={\`precip-${currentFrame.t}\`}>` zwingt Leaflet bei jedem Frame-Wechsel zu vollständigem Unmount + Mount (DOM-`<img>` neu erzeugen, Layer aus der Map entfernen/hinzufügen). Beim Scrubben über z.B. 30 Frames passiert das 30× in Sekundenbruchteilen.
2. `onPointerMove` ruft `onChange` synchron bei jedem Pointer-Event (häufiger als die Display-Refresh-Rate) → zusätzliche React-Renders ohne sichtbaren Nutzen.
3. Der `prevPngFrame`-`useState`+`useEffect`-Pfad löst pro Frame-Wechsel einen zweiten Render aus.

## Fix (`src/components/maps/radar-map.tsx`)

### 1. Stabile ImageOverlays — kein Key-Remount
`react-leaflet` ruft bei Änderung der `url`-Prop intern `setUrl()` auf dem bestehenden Leaflet-Layer auf (kein DOM-Tausch, nur `img.src` Update). Da alle PNGs vorgeladen sind, ist der neue Frame sofort da.

- Die `key`-Props auf den `<ImageOverlay>`-Instanzen entfernen (oder durch eine stabile Konstante wie `key="precip-main"` ersetzen) — so bleibt der Leaflet-Layer über alle Frame-Wechsel bestehen.
- Den Hagel-`<ImageOverlay>` analog auf stabilen Key umstellen (`key="hail-main"`).

### 2. Backdrop-Layer entfernen
Da der Haupt-Overlay jetzt nicht mehr neu mountet, gibt es keinen Leerframe → `prevPngFrame` + `prevPngRef` + zugehöriges `useEffect` sind überflüssig. Entfernen, inkl. des zweiten `<ImageOverlay>` für den Vorgängerframe (Zeilen ~951–966 und ~1091–1103). Das spart einen Render-Pfad und einen Leaflet-Layer.

### 3. Pointer-Move throttlen via requestAnimationFrame
In `MeteoTimeline` (`handlePointerMove`, Zeilen 663–666): den `onChange`-Aufruf in einen rAF-Coalescer wickeln, damit pro Animationsframe maximal ein State-Update läuft.

```ts
const rafRef = useRef<number | null>(null);
const pendingXRef = useRef<number | null>(null);
const handlePointerMove = (e: React.PointerEvent) => {
  if (!dragging) return;
  pendingXRef.current = e.clientX;
  if (rafRef.current != null) return;
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    const x = pendingXRef.current;
    if (x != null) onChange(idxFromClientX(x));
  });
};
```
Bei `pointerup`/`pointercancel` den ausstehenden rAF cancellen.

### 4. (Optional, klein) Memoization
Falls nach 1–3 noch spürbares Ruckeln auftritt: `idxFromClientX` mit `useCallback` stabilisieren — Haupteffekt ist aber 1+3.

## Out of scope
- Auto-Play-Crossfade Canvas↔Canvas (PrecipOverlay) bleibt unverändert.
- PNG-Preload bleibt unverändert (Voraussetzung dafür, dass `setUrl` ohne Flicker funktioniert).
- Server-/Manifest-Logik, Hagel-Logik, Farbskala unverändert.

## Erwartetes Resultat
Während des Drags wird nur noch `img.src` des bestehenden Overlays getauscht (sofort aus Cache) + maximal ein React-Render pro Display-Frame. Kein Layer-Mount/Unmount, kein zweiter „Backdrop"-Layer, keine Render-Lawine durch Pointer-Events.
