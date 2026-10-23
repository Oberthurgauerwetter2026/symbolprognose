# Zwischenstriche im Filmstrip wieder weiss wie früher

## Was sich ändert
- Die Striche zwischen den vollen Stunden (Viertelstunde, 5 Minuten) werden wieder so weiss und gut sichtbar wie vor den Änderungen.
- Die neuen weissen Stundenlinien bleiben, damit die vollen Stunden weiterhin hervorstechen.
- Gilt für Radar, Satellit und Wind.
- Danach in Handygrösse prüfen, im grauen Messteil und im blauen Prognoseteil.

## Technische Details
- `src/components/maps/filmstrip-timeline.tsx`, Zwischenticks: zurück auf den Stand von früher, `bg-white/75` (statt `bg-white/35` bzw. `bg-white/25`), Höhe und Position wie vorher.
- Stunden-Strich (`top-5 h-6 w-[2px] bg-white` mit dunklem Rand) bleibt unverändert.
