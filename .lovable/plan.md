## Ziel

Standard-Standort auf **Amriswil** korrigieren. Aktuell steht im Code zwar der Name „Amriswil", die Koordinaten (47.5504 / 9.3021) zeigen aber auf Romanshorn.

## Änderung in `src/components/weather-widget.tsx` (Z. 19–23)

```ts
const DEFAULT_LOCATION = {
  name: "Amriswil",
  latitude: 47.5469,
  longitude: 9.298,
};
```

## Hinweis zum localStorage

Falls bereits ein Standort unter `weather:location` gespeichert ist (z.B. via Suche oder vorheriger Default), bleibt dieser bestehen. Über die Suchleiste oben („Gemeinde suchen…") lässt sich Amriswil dann jederzeit neu auswählen — die korrigierten Default-Koordinaten greifen nur bei neuen Besuchern ohne gespeicherten Standort.
