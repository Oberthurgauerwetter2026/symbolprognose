# Radar-Karte: Orte, See-Farbe, Slider-Refresh

Alle Änderungen in `src/components/maps/radar-map.tsx`. Keine Backend- oder anderen Datei-Änderungen.

## 1. Romanshorn → Güttingen
In `RADAR_CITIES` den Eintrag `Romanshorn` ersetzen durch:
```ts
{ name: "Güttingen", lat: 47.6011, lon: 9.2917 },
```

## 2. See in gleicher Farbe wie Symbolprognose "Region"
Aktuell (radar-map.tsx, Z. 643–647):
```tsx
<GeoJSON data={LAKE}
  style={() => ({ color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 0.9 })} ... />
```
Anpassen exakt wie in `region-map.tsx` (Z. 617–625):
```tsx
style={() => ({ color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 1 })}
```
(`fillOpacity: 0.9` → `1`, sonst gleich — damit der See unter dem leichten Radar-Overlay konstant in der Region-Farbe erscheint und nicht durch Niederschlagspixel verfärbt wirkt.)

## 3. Aufzählungszeichen vor Ortsnamen
In `cityIcon()` den weissen Punkt (8 px Kreis mit dunklem Rand) ersetzen durch ein typografisches Bullet `•` in Markenblau mit weissem Halo:

```ts
const bullet = "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2561a1;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;line-height:1;margin-right:4px;";
const label  = "font:500 12px/1 system-ui,...;color:#1a1a1a;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;white-space:nowrap;";
html: `<div style="display:flex;align-items:center;pointer-events:none;transform:translate(-3px,-7px);"><span style="${bullet}">•</span><span style="${label}">${name}</span></div>`
```
Resultat: `• Amriswil` — kompakter, lesbar auf jedem Untergrund, kein „kitschiger" Doppelkreis mehr.

## 4. Slider: moderner, ruhiger, smartphone-friendly
Ziel: weniger Farbe/Gradient-„Kitsch", klare Hierarchie, grosse Touch-Targets.

Änderungen in `Timeline` (Z. 350–527):

a) **Track flacher, dezentere Segmente**
- Höhe `h-10` → `h-2.5` für die Track-Linie selbst (statt fetter Pille).
- Wrapper-Höhe bleibt grosszügig (`py-3`), damit Touch-Trefferfläche weiterhin ≥ 44 px hoch ist (`touch-none`, `cursor-pointer` auf dem Wrapper, nicht dem dünnen Track).
- Bisherige 3 farbigen Verlaufs-Segmente ersetzt durch dezente, einfarbige Bereiche:
  - Vergangenheit: `bg-muted-foreground/25`
  - ICON-CH1: `bg-[hsl(var(--primary)/0.45)]` (Markenblau, halbtransparent)
  - ICON-CH2: gestreiftes Pattern in derselben Farbe mit `0.25` Alpha, um „Modellunsicherheit" optisch anzudeuten (CSS `repeating-linear-gradient`, 6 px Streifen).
- Keine Rundungen an den Übergängen zwischen Segmenten, nur an den äusseren Enden (`rounded-full` am Outer-Track).

b) **„Jetzt"-Linie subtiler**
- 1 px statt 2 px, Farbe `bg-foreground/60`. Punkt oben entfällt.

c) **Handle moderner und grösser für Touch**
- Aktuell 20 px (`h-5 w-5`). Neu: 22 px (`h-[22px] w-[22px]`) auf Mobile, 18 px (`sm:h-[18px] sm:w-[18px]`) auf Desktop. Weisser Kreis mit 2 px Border in `--primary`, schlichter `shadow-sm` (kein dicker `shadow-md`).
- Tooltip-Bubble (`handleLabel`):
  - Nur sichtbar während Drag oder bei `:hover`/`:focus-visible` des Tracks — per State `dragging` + `focused`. Vorher immer sichtbar → wirkt überladen.
  - Styling: `bg-foreground text-background`, `rounded-md`, `px-2 py-1`, `text-[11px] font-medium`, kleines nach unten zeigendes Dreieck via `::after`.

d) **Tick-Labels reduzieren**
- Aktuelle Tick-Liste `[-2, -1, 0, 1, 3, 6, 12, 24, 48, 120]` ist auf 320 px Breite überfüllt.
- Neu: Container hat `useIsMobile()`-Check. Auf Mobile zeigt nur `[-1, 0, 6, 24, 72]`, auf Desktop unverändert `[-2, -1, 0, 3, 12, 24, 48, 120]` (1 h entfällt überall, 72 h kommt dazu).
- `text-[10px]` → `text-[11px]`, Tick-Container `mb-1 h-4` → `mb-1.5 h-3.5`.

e) **Buttons-Reihe (Play/Jetzt/Speed/Hagel) smartphone-tauglich**
- Aktueller Wrapper `flex flex-wrap items-center gap-2`. Auf 360 px landet Hagel in eigener Reihe — ok.
- Touch-Targets: alle Buttons auf `min-h-9` (statt `size="sm"` mit ~32 px). Speed-Pills `py-1` → `py-1.5`.
- Reihenfolge auf Mobile per `order`-Klassen: Play | Jetzt | Hagel | Speed (Speed nach hinten, da seltener gebraucht).

f) **Kein Radix-Slider**: bleibt eigene Pointer-Implementation, nur das Markup wird umgebaut. Tastatur-Support (←/→) bleibt.

## Out of Scope
- `radar.functions.ts`, Cache, Backend, andere Karten — unverändert.
- Keine neuen Pakete.
- `src/data/spots.ts` bleibt unverändert (Liste ist nur lokal in `radar-map.tsx`).

## Verification
1. `/karten/radar`: `• Güttingen` statt Romanshorn, kein doppelter Kreis mehr, Bullet in Markenblau.
2. Bodensee zeigt dieselbe Farbe wie in der Symbolprognose „Region" (auch wenn Niederschlag drüber zieht).
3. Slider auf Desktop (1336 px): dünner Track, 3 Phasen sichtbar (grau / blau / blau-gestreift), Tooltip nur bei Drag.
4. Slider auf 375 px (iPhone): Touch-Drag flüssig, Handle ≥ 22 px, weniger Tick-Labels, keine überlappenden Buttons.
