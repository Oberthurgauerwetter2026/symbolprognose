## Ziel
Der Zeitslider nimmt aktuell zu viel vertikalen Platz ein (Touch-Variante mit `py-3`, `h-6` Thumb und `pt-10` Container). Er soll insgesamt schmaler werden, ohne die Bedienbarkeit zu beeinträchtigen.

## Änderungen

### 1. `src/components/ui/slider.tsx`
- Touch-Variante: `py-3` → `py-1.5` reduzieren
- Thumb: `h-6 w-6` → `h-5 w-5` (20px statt 24px)
- Invisible Hit-Area (`before:-inset-3`) entsprechend anpassen zu `before:-inset-2.5`

### 2. `src/components/region-map.tsx`
- Slider-Container: `pt-10` → `pt-8` reduzieren
- Vertikale Marker-Linie: `top: "1.25rem"` → `top: "1rem"` anpassen, damit sie zum schmaleren Slider passt