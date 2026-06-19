## Änderung

In `src/components/weather-widget.tsx`, Zeile 1326 (Legenden-Leiste unterhalb des Panels):

Die zwei kleinen Säulen-/Balken-Icons (inline `<span>` mit `bg-[var(--wx-rain)]`, jeweils 40 % und 70 % Höhe) vor dem Tropfen-Icon werden entfernt. Übrig bleibt nur noch:

`💧 mm (sicher) · % (Risiko)`

Wind-, Sonne- und Schnee-Legenden bleiben unverändert.

### Technisch

```tsx
// vorher
<span className="inline-flex items-center gap-1.5">
  <span className="inline-flex items-end w-2.5 h-3 ..."><span ... /></span>
  <span className="inline-block w-2.5 h-3 ..."><span ... /></span>
  <Droplet ... /> mm (sicher) · % (Risiko)
</span>

// nachher
<span className="inline-flex items-center gap-1.5">
  <Droplet ... /> mm (sicher) · % (Risiko)
</span>
```
