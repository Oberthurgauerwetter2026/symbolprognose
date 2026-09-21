# Suchfeld aus der Regionskarte entfernen

## Ziel
Das Ortssuchfeld (Overlay-Band oben auf der Regionskarte) wird entfernt. Die Karte selbst, Warnbanner, Marker und die Tages-/Stundenauswahl bleiben unverändert.

## Umsetzung
1. `src/components/region-map.tsx`: Den `<LocationSearch variant="overlay" … />`-Block aus dem Kartenrahmen entfernen. Import aufräumen, falls danach unbenutzt.
2. Aufräumen toter Verdrahtung (Folge der Entfernung):
   - `src/routes/embed.region.tsx`: Der Zweig, der nach einer Ortssuche die Lokalprognose unterhalb der Karte einblendet, ist über die Suche nicht mehr erreichbar. Die `onSelectSpot`-Prop bleibt an der Komponente bestehen (typisiert, ohne Funktion), damit keine weiteren Dateien betroffen sind.
3. Nicht anfassen: Die Ortssuche in der Lokalprognose (`weather-widget.tsx`) und das separate Such-Snippet bleiben unverändert — nur die Regionskarte verliert das Suchfeld.

## Betroffene Ansichten
- `/karten/region` (Regionskarte)
- `/embed/region` (WP-Snippet Region)
- `/embed/all` (Kombifragment, Region-Tab)
- Kombifragment Region + Lokalprognose

## Verifikation
- Typecheck (`tsgo --noEmit`) und Build
- Playwright: `/karten/region` und `/embed/region` laden, Karte ohne Suchfeld, Warnbanner und Marker intakt
