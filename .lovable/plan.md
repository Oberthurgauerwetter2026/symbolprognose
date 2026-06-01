## Ziel
In der Radar-Farblegende (oben rechts, neben mm/h und Schnee) einen Eintrag für die Hagelerkennung (POH) ergänzen, damit klar ist, was die schwarzen Punkte in der Messung bedeuten.

## Änderung
**`src/components/maps/radar-map.tsx`** — in der Legende (Zeile ~1113–1135), unterhalb des Schnee-Blocks, einen neuen Hagel-Block hinzufügen:

```tsx
<span className="mt-1.5 mb-0.5 font-semibold text-foreground">Hagel</span>
<div className="flex items-center gap-1.5">
  <span
    className="inline-block h-2.5 w-3 rounded-sm bg-white sm:h-3 sm:w-4"
    style={{
      backgroundImage:
        "radial-gradient(circle, #000 35%, transparent 36%)",
      backgroundSize: "4px 4px",
    }}
  />
  <span className="text-muted-foreground">POH</span>
</div>
```

- Visuell: weisses Feld mit schwarzen Punkten — entspricht genau dem `hail-blackdots`-Overlay (POH-PNG, `filter: brightness(0)`) auf der Karte.
- Label: „Hagel" als Sektionstitel, „POH" als Zeile (Probability of Hail, MeteoSchweiz-Standard, taucht bereits im Toggle-Tooltip auf).
- Nur eine Zeile, da das POH-PNG ohnehin nur eine binäre Punkte-Darstellung liefert (keine Stufen).

## Nicht geändert
- Keine Logik, kein Toggle-Verhalten, kein Datenpfad.
- Legende bleibt ausgeblendet, wenn die Karte keine Hagel-Frames hat? → Nein, Legende bleibt statisch sichtbar (analog Schnee, das ebenfalls immer angezeigt wird). Falls gewünscht, kann der Block bedingt via `data?.hasHail` gerendert werden — frage ich nicht extra ab, default = immer sichtbar zur Erklärung der Symbolik.