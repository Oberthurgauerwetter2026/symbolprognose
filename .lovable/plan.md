## Ziel

In der Wetterkarte (`/karte`) soll ein Klick auf einen Wochentag in der Tagesleiste die Karte unmittelbar auf die **Tagesübersicht dieses Tages** umschalten — unabhängig davon, wo der Zeit-Slider vorher stand. Es findet **keine Navigation auf `/`** mehr statt; der Nutzer bleibt in der Karte.

## Änderung

**Datei:** `src/components/region-map.tsx`

### Verhalten der Wochentag-Buttons

- Statt `router.navigate({ to: "/", search: { day: i } })` setzt der Klick `stepOffset` so, dass `absoluteHour` auf den ersten verfügbaren 3-h-Slot des Zieltages fällt:
  - Tag 0 (heute) → `stepOffset = 0` (aktueller Slot)
  - Tag i > 0 → `stepOffset = Math.ceil((i * 24 - baseHour) / 3)`, geclamped auf `[0, MAX_STEPS - 1]`
- Damit zeigt die Karte sofort den Tagesanfang des gewählten Tages; der bisherige Slider-Stand wird verworfen.
- `router` wird nicht mehr für diese Aktion gebraucht — Import bleibt nur, falls anderswo verwendet (sonst entfernen).

### Unverändert

- 7-Tage-Leiste, Slider, Stundenlegende, Tag-/Nacht-Logik, Marker-Klick (öffnet weiterhin Symbolprognose), Relief und Masken.
- Die `?day=`-Suchparameter-Unterstützung in `src/routes/index.tsx` und `WeatherWidget` (`initialDayIdx`) bleibt bestehen, wird hier aber nicht mehr ausgelöst.

## Technische Details

```ts
onClick={() => {
  const target = i === 0
    ? 0
    : Math.min(MAX_STEPS - 1, Math.max(0, Math.ceil((i * 24 - baseHour) / 3)));
  setStepOffset(target);
}}
```

Alle 7 Tage bleiben anklickbar (kein `disabled`).
