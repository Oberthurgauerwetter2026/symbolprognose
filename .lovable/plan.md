# Warnkarte auf dem Smartphone abrunden

Ziel: Karte und Warntext sollen auf dem Handy gemeinsam ohne viel Scrollen lesbar sein.

## Änderungen (nur mobile Darstellung)

1. Kartenhöhe mobil von 340 px auf 320 px reduzieren; ab Tablet/Desktop bleibt es bei 600 px.
2. Das Info-Panel darf mobil etwas mehr Platz nutzen: Warnliste von max. 300 px auf max. 340 px, mit eigenem Scrollbereich.
3. Ein dezenter Verlauf am unteren Panelrand zeigt an, dass die Liste weiterscrollt.

Desktop, Tablet, `bare`-Embeds und Widget-Snapshots behalten ihre bisherigen Höhen. Reine Layout-Änderung, keine Datenlogik.

## Technische Details

- `src/components/maps/warn-map.tsx`
  - Kartencontainer (Zeile 480): `h-[340px]` → `h-[320px]`, Breakpoint-Klassen unverändert.
  - Warnlisten-Container (Zeile 695): `max-h-[300px]` → `max-h-[340px]`, `sm:max-h-none` bleibt.
  - Scroll-Hinweis: absoluter Gradient-Overlay (`pointer-events-none`, `from-background`) am unteren Rand des mobilen Panels, ab `sm` ausgeblendet.

## Prüfung

Warnkarte im Handy-Hochformat (390×844) öffnen: Karte plus erster Warntext sichtbar, Liste scrollt intern. Desktop unverändert.
